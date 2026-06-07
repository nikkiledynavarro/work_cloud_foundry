/*global location*/
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/viewacefiling/controller/BaseController",
	"com/erpis/shiperp/hr7/viewacefiling/model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"com/erpis/shiperp/hr7/viewacefiling/common/Utils",
	"com/erpis/shiperp/hr7/viewacefiling/common/ContentTermsHtml",
], function (library, BaseController, formatter, JSONModel, Token, Filter, MessageBox, MessageToast, Fragment, Utils, ContentTermsHtml) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.viewacefiling.controller.Main", {

		formatter: formatter,

		oBundle: null, // i18n bundle class
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public 
		 */
		onInit: function () {
			this.oInputTypeDeferred = $.Deferred();
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			// Local Model for view
			this.setModel(new JSONModel({
				modelData: [0],
				Pagination: {
					Total: 0,
					nPage: 0,
					ncurrNum: 0
				},
				EnableCancel: false
			}), "local");
			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");
			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.sProfileId = oEvent.getParameter("arguments").ProfileId;
			this.bcheckAuthenticate = false;
			$.when(this._getBindingData()).done(function () {
				this.getModel("local").setProperty("/EnableButton", false)
				this.hideBusy();
			}.bind(this));
		},
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		_getBindingData: function () {
			var deferred = $.Deferred();
			this.getModel().read("/AceViewQuerySet", {
				filters: [
					new Filter("ProfileId", "EQ", this.sProfileId)
				],
				urlParameters: {
					"$expand": "Authenticate,View_Data,Return"
				},
				success: function (oData) {
					if (oData.results.length > 0) {
						var aDataResults = oData.results[0];
						this.getModel("local").setProperty("/UserVerified", aDataResults);
						if (aDataResults.Return && aDataResults.Return.results.length > 0) {
							var aMsg = this._generateMessages(aDataResults.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						} else {
							var oPageModel = this.getView().getModel("local");
							var totalItems = (aDataResults.View_Data.results).length;
							var aListEntries = [];
							if (totalItems > 0) {
								this.getModel("local").setProperty("/showPagination", true);
								for (var i = 0; i < totalItems; i++) {
									aListEntries.push(i + 1);
								}
								this.getModel("local").setProperty("/modelData", aListEntries);
								if (totalItems > 100) {
									oPageModel.setSizeLimit(aListEntries);
								}
								//pagination button
								var iNumSelect = 10;
								if (totalItems < 10) {
									iNumSelect = totalItems;
								}
								var nTotal = Math.ceil(totalItems / iNumSelect);
								this.getModel("local").setProperty("/Pagination", {
									ncurrNum: 1,
									nPage: iNumSelect,
									Total: nTotal
								});
								var aFinalData = [];
								aFinalData = this.handlePagination(aDataResults.View_Data.results, iNumSelect, 1);
								this.getModel("local").setProperty("/AceFilings", aFinalData);
							}
						}
					} else {
						this.getModel("local").setProperty("/AceFilings", []);
					}
					deferred.resolve();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					deferred.reject();
				}.bind(this)
			});
			return deferred.promise();
		},

		handlePagination: function (array, page_size, page_number) {
			return array.slice((page_number - 1) * page_size, page_number * page_size);
		},

		onChangeNum: function (oEvent) {
			this.showBusy();
			this.getModel().read("/AceViewQuerySet", {
				filters: [
					new Filter("ProfileId", "EQ", this.sProfileId)
				],
				urlParameters: {
					"$expand": "Authenticate,View_Data,Return"
				},
				success: function (oData) {
					var aData = oData.results[0].View_Data.results;
					var iValue = parseInt(oEvent.getSource().getSelectedKey());
					var aSelectedItems = aData.splice(0, iValue);
					this.getView().getModel("local").setProperty("/AceFilings", aSelectedItems);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onSearch: function (oEvent) {
			var sValue = oEvent.getSource().getValue().trim();
			var aFilters = [];
			if (sValue.length > 0) {
				var oFilter = new Filter({
					filters: [
						new Filter("DeliveryNo", "Contains", sValue),
						new Filter("ShipmentRefNo", "Contains", sValue),
						new Filter("InvoiceNo", "Contains", sValue),
						new Filter("ShipmentNo", "Contains", sValue)
					],
					and: false,
				});
				aFilters.push(oFilter);
			}
			this.byId("tableItem").getBinding("items").filter(aFilters);
		},

		onSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();
			var oSelected = oTab.getSelectedItem().getBindingContext("local").getObject();
			var aAceFilings = this.getModel("local").getProperty("/AceFilings");
			var aDataProccess = [];
			var sDelivery = "";
			var bStatus = true;
			aAceFilings.forEach(function (item) {
				if (item.DeliveryNo === oSelected.DeliveryNo) {
					sDelivery = item.DeliveryNo;
					//Check Status cancelled documents
					if (oSelected.Status !== "C") {
						item.Selected = true;
					} else {
						item.Selected = false;
						bStatus = false;
						return;
					}
				} else {
					item.Selected = false;
				};
				aDataProccess.push(item);
			})
			this.getModel("local").setProperty("/ViewACEFiling", aDataProccess);
			// Check enable button
			this.getModel("local").setProperty("/EnableButton", true);
			// get delivery number
			this.getModel("local").setProperty("/Deliveries", sDelivery);
			this.getModel("local").setProperty("/EnableCancel", bStatus);
		},

		// --- Cancel View ACE Filing ---
		_processCancel: function () {
			this.showBusy();
			var oRequestPayload = this.generateViewProcessCancelPayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData) {
						if (oData.Return && oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						} else {
							var oPageModel = this.getView().getModel("local");
							var totalItems = (oData.View_Data.results).length;
							var aListEntries = [];
							if (totalItems > 0) {
								this.getModel("local").setProperty("/showPagination", true);
								for (var i = 0; i < totalItems; i++) {
									aListEntries.push(i + 1);
								}
								this.getModel("local").setProperty("/modelData", aListEntries);
								if (totalItems > 100) {
									oPageModel.setSizeLimit(aListEntries);
								}
								//pagination button
								var iNumSelect = 10;
								if (totalItems < 10) {
									iNumSelect = totalItems;
								}
								var nTotal = Math.ceil(totalItems / iNumSelect);
								this.getModel("local").setProperty("/Pagination", {
									ncurrNum: 1,
									nPage: iNumSelect,
									Total: nTotal
								});
								var aFinalData = [];
								aFinalData = this.handlePagination(oData.View_Data.results, iNumSelect, 1);
								this.getModel("local").setProperty("/AceFilings", aFinalData);
							}
						}
					} else {
						this.getModel("local").setProperty("/AceFilings", []);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onProcessCancel: function (oEvent) {
			//check authenticated Process Cancel
			var bAuthenticated = this.getModel("local").getProperty("/UserVerified/Authenticate/Authenticated");
			if (!bAuthenticated) {
				this.bcheckAuthenticate = true;
				this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
				this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
				this._oAuthenticateProcessCancel = Utils.getFragment(null, "Authenticate.ProcessCancel.PrivacyActStatement", this);
				this._oAuthenticateProcessCancel.open();
			} else {
				this._processCancel();
			}
		},

		generateViewProcessCancelPayload: function () {
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oPayload = {
				Action: "VIEW_Process_Cancel",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Authenticate: oAuthenticate,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		//--- Check Authenticate ---
		onCheckAuthenticated: function (oEvent) {
			//check authenticated 
			var bAuthenticated = this.getModel("local").getProperty("/UserVerified/Authenticate/Authenticated");
			if (!bAuthenticated) {
				this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
				this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
				this._oAuthenticate = Utils.getFragment(null, "Authenticate.GetWebStatus.PrivacyActStatement", this);
				this._oAuthenticate.open();
			} else {
				this._checkGetWebStatus();
			}
		},

		_checkGetWebStatus: function () {
			var oRequestPayload = this.generateViewGetWebStatusPayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData) {
						var oPageModel = this.getView().getModel("local");
						if (oData.Return && oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Authenticate.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						} else {
							oPageModel.setProperty("/UserVerified", oData);
							var totalItems = (oData.View_Data.results).length;
							var aListEntries = [];
							if (totalItems > 0) {
								this.getModel("local").setProperty("/showPagination", true);
								for (var i = 0; i < totalItems; i++) {
									aListEntries.push(i + 1);
								}
								this.getModel("local").setProperty("/modelData", aListEntries);
								if (totalItems > 100) {
									oPageModel.setSizeLimit(aListEntries);
								}
								//pagination button
								var iNumSelect = 10;
								if (totalItems < 10) {
									iNumSelect = totalItems;
								}
								var nTotal = Math.ceil(totalItems / iNumSelect);
								oPageModel.setProperty("/Pagination", {
									ncurrNum: 1,
									nPage: iNumSelect,
									Total: nTotal
								});
								var aFinalData = [];
								aFinalData = this.handlePagination(oData.View_Data.results, iNumSelect, 1);
								oPageModel.setProperty("/AceFilings", aFinalData);
							}
						}
					} else {
						oPageModel.setProperty("/AceFilings", []);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateViewGetWebStatusPayload: function () {
			var oAuth = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Get_Web_Status",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuth,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		// -- Continue Login ---
		onContineuLogin: function (oEvent) {
			this.showBusy();
			// Check authenticate process cancel and view get web status
			if (this.bcheckAuthenticate) {
				this._oAuthenticateProcessCancel.close();
			} else {
				this._oAuthenticate.close();
			}
			var oRequestPayload = this.generateContinueLoginPayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						if (aMsg[0].type === "Error") {
							MessageBox.error(aMsg[0].title);
						} else if (aMsg[0].type === "Success") {
							MessageBox.success(aMsg[0].title);
						}
					} else {
						if (oData.Authenticate.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Authenticate.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						}
						this.getModel("local").setProperty("/UserVerified", oData);
						this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
						this._TwoFactorAthen = Utils.getFragment(null, "Authenticate.TwoFactorAuthenticate", this);
						this._TwoFactorAthen.open();
					}

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateContinueLoginPayload: function () {
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			// Set Cookies for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Cookies", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		// --- Confirm Authencation ---
		onConfirmAuthencation: function () {
			this.showBusy();
			var oRequestPayload = this.generateGetPrivacyActPayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Privacy_Act !== "") {
						var sURL = oData.Privacy_Act;
						window.open(sURL);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateGetPrivacyActPayload: function () {
			var oAuth = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Get_Privacy_Act",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuth,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		// --- Verify Authenticate ---
		onVerifyPress: function () {
			var sValue = this.getModel("local").getProperty("/UserVerified/Authenticate/Token");
			if (sValue !== "") {
				this.showBusy();
				var oRequestPayload = this.generateVerifyPayload();
				this.getModel().create("/AceViewQuerySet", oRequestPayload, {
					success: function (oData) {
						if (oData.Authenticate.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Authenticate.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						} else {
							var ContentTerms = "";
							if (oData.Authenticate.Html !== "") {
								this.getModel("local").setProperty("/UserVerified", oData);
								var forms = this._convertTermsHtml(oData.Authenticate.Html);
								var ContentTerms = ContentTermsHtml.getContentTermsHtml(forms);
							}
							var oHtml = new sap.ui.core.HTML({
								content: ContentTerms
							});
							var oDialog = new sap.m.Dialog({
								title: "U.S. Customs and Border Protection",
								contentWidth: "800px",
								contentHeight: "600px",
								content: [oHtml],
								beginButton: new sap.m.Button({
									text: "Accept",
									type: "Success",
									press: function () {
										// Await function
										$.when(this._getAuthenticate()).done(function () {
											if (this.bcheckAuthenticate) {
												this.bcheckAuthenticate = false;
												this._processCancel();
											} else {
												this._checkGetWebStatus();
											}
											oDialog.close();
											this._TwoFactorAthen.close();
										}.bind(this));
									}.bind(this)
								}),
								endButton: new sap.m.Button({
									text: "Decline",
									type: "Reject",
									press: function () {
										this._DeclineButton(oDialog);
									}.bind(this)
								})
							});
							oDialog.open();
						}
						this.getModel("local").setProperty("/UserVerified/Authenticate/Verify", false);
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				MessageBox.error(this.oBundle.getText("requiredEntryFields"));
			}
		},

		_getAuthenticate: function () {
			var deferred = $.Deferred();
			this.showBusy();
			var oRequestPayload = this.generateAuthenticatePayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						if (aMsg[0].type === "Error") {
							MessageBox.error(aMsg[0].title);
						} else if (aMsg[0].type === "Success") {
							MessageBox.success(aMsg[0].title);
						}
					} else {
						if (oData.Authenticate.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Authenticate.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						}
						this.getModel("local").setProperty("/UserVerified", oData);
					}
					this.hideBusy();
					deferred.resolve();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
					deferred.reject(oError);
				}.bind(this)
			});
			return deferred.promise();
		},

		generateAuthenticatePayload: function () {
			this.getModel("local").setProperty("/UserVerified/Authenticate/TermsAccept", true);
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		_convertTermsHtml: function (Html) {
			var Parser = new DOMParser();
			var Document = Parser.parseFromString(Html, "text/html");
			var scripts = Document.querySelectorAll('script');
			var styles = Document.querySelectorAll('style');
			scripts.forEach(function (script) {
				script.parentNode.removeChild(script);
			});
			styles.forEach(function (style) {
				style.parentNode.removeChild(style);
			});
			return Document.querySelectorAll('form')[0];
		},

		// --- Decline Button ---
		_DeclineButton: function (oDialog) {
			MessageBox.warning(this.oBundle.getText("confirmAuthenticate"), {
				title: "Warning",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (sAction) {
					if (sAction === "NO") {
						return;
					} else if (sAction === "YES") {
						oDialog.close();
						this._TwoFactorAthen.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},

		generateVerifyPayload: function () {
			this.getModel("local").setProperty("/UserVerified/Authenticate/Verify", true);
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		// --- Resend Email ---
		onResendPress: function () {
			this.showBusy();
			this.getModel("local").setProperty("/UserVerified/Authenticate/Resend", true);
			// Remove token for resend authenticate
			this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
			var oRequestPayload = this.generateResendPayload();
			this.getModel().create("/AceViewQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						if (aMsg[0].type === "Error") {
							MessageBox.error(aMsg[0].title);
						} else if (aMsg[0].type === "Success") {
							MessageBox.success(aMsg[0].title);
						}
					} else {
						if (oData.Authenticate.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Authenticate.Return.results);
							if (aMsg[0].type === "Error") {
								MessageBox.error(aMsg[0].title);
							} else if (aMsg[0].type === "Success") {
								MessageBox.success(aMsg[0].title);
							}
						}
						this.getModel("local").setProperty("/UserVerified", oData);
					}
					this.getModel("local").setProperty("/UserVerified/Authenticate/Resend", false);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		generateResendPayload: function () {
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/ViewACEFiling");
			var oPayload = {
				Action: "VIEW_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				View_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		onCancelAuthenticate: function () {
			MessageBox.warning(this.oBundle.getText("confirmAuthenticate"), {
				title: "Warning",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (sAction) {
					if (sAction === "NO") {
						return;
					} else if (sAction === "YES") {
						this._TwoFactorAthen.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},

		onCancelParivacyAct: function () {
			MessageBox.warning(this.oBundle.getText("confirmAuthenticate"), {
				title: "Warning",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (sAction) {
					if (sAction === "NO") {
						return;
					} else if (sAction === "YES") {
						this._oAuthenticateProcessCancel.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},

		onCloseParivacyAct: function () {
			MessageBox.warning(this.oBundle.getText("confirmAuthenticate"), {
				title: "Warning",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (sAction) {
					if (sAction === "NO") {
						return;
					} else if (sAction === "YES") {
						this._oAuthenticate.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},
		//------ Navigration application ------
		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");
			if (!shellHash) {
				return;
			}
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		//------ Navigration Submit Ace filing application ------
		onViewSubmitAceFiling: function (oEvent) {
			var oSelectedItem = this.getModel("local").getProperty("/Deliveries");
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}

			shellHash += '&/Main/' + encodeURIComponent(this.sProfileId) + '/' + encodeURIComponent(oSelectedItem);

			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},
		/* Handle Message */
		_generateMessages: function (aParamMessages) {
			var aMessages = [];
			for (var i = 0; i < aParamMessages.length; i++) {
				var oMessage = this._generateMessageObject(aParamMessages[i]);
				if (oMessage) {
					aMessages.push(oMessage);
				}
			}
			return aMessages;
		},
		_generateMessageObject: function (oPassMessage) {
			var oMessage = {
				type: "Warning",
				title: oPassMessage.Message,
				description: ""
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = library.Error;
				break;
			case "W":
				oMessage.type = library.Warning;
				break;
			case "I":
				oMessage.type = library.Information;
				break;
			case "S":
				oMessage.type = library.Success;
				break;
			default:
				oMessage.type = library.Warning;
				break;
			}
			return oMessage;
		},
		//end
	})
});