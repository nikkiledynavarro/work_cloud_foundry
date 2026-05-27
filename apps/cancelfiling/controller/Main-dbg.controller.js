/*global location*/
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/cancelfiling/controller/BaseController",
	"com/erpis/shiperp/hr7/cancelfiling/model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"com/erpis/shiperp/hr7/cancelfiling/common/Utils",
	"com/erpis/shiperp/hr7/cancelfiling/common/ContentTermsHtml",
], function (library, BaseController, formatter, JSONModel, Token, Filter, MessageBox, MessageToast, Fragment, Utils, ContentTermsHtml) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.cancelfiling.controller.Main", {

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
				EnableButton: false
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
			this.sProfileId = oEvent.getParameter("arguments").ProfileId;
			this.sInputType = '03';
			// Register event load for combobox input type
			this.byId("idInputType").getBinding("items").attachDataReceived(this.onInputTypeLoaded(), this);
			this.hideBusy();
			$.when(this.oInputTypeDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();
			var oSelected = oTab.getSelectedItem().getBindingContext("local").getObject();
			var aAceFilings = this.getModel("local").getProperty("/AceFilings");
			var aDataProccess = [];
			aAceFilings.forEach(function (item) {
				if (item.DeliveryNo === oSelected.DeliveryNo) {
					item.Selected = true;
				} else {
					item.Selected = false;
				};
				aDataProccess.push(item);
			})
			this.getModel("local").setProperty("/AceFilings", aDataProccess);
			// Check enable button
			this.getModel("local").setProperty("/EnableButton", true);
		},

		onInputTypeChange: function () {
			var oTypeSelect = this.byId("idInputType");
			this.sInputType = oTypeSelect.getSelectedKey();
		},

		// Enter press on the search text on the header toolbar
		onCancel: function (oEvent) {
			this.showBusy();
			this.byId("idInputType").setEditable(false);
			this.byId("idCancelNo").setEditable(false);
			this.sInputId = this.byId("idCancelNo").getValue();

			if (oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("idCancelNo").setEditable(true);
				this.byId("idInputType").setEditable(true);
				this.byId("idCancelNo").setValueState("Error");
				this.hideBusy();
				return;
			} else {
				this.byId("idCancelNo").setValueState("None");
			}

			var sPath = "/AceCancelQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("InputType", "EQ", this.sInputType),
					new Filter("InputId", "EQ", this.sInputId),
					new Filter("ProfileId", "EQ", this.sProfileId),
				],
				urlParameters: {
					"$expand": "Authenticate,Cancel_Data,Return"
				},
				success: function (oData) {
					if (oData.results.length > 0) {
						var adata = oData.results[0];
						this.getModel("local").setProperty("/UserVerified", adata);

						if (oData.Return && oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						} else {
							var totalItems = (adata.Cancel_Data.results).length;
							var aListEntries = [];
							if (totalItems > 0) {
								this.getModel("local").setProperty("/showPagination", true);
								for (var i = 0; i < totalItems; i++) {
									aListEntries.push(i + 1);
								}
								this.getModel("local").setProperty("/modelData", aListEntries);
								if (totalItems > 100) {
									this.getModel("local").setSizeLimit(aListEntries);
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
								aFinalData = this.handlePagination(adata.Cancel_Data.results, iNumSelect, 1);
								this.getModel("local").setProperty("/AceFilings", aFinalData);
							}
						}
						this.getModel("local").setProperty("/AceFilings", adata.Cancel_Data.results);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		handlePagination: function (array, page_size, page_number) {
			return array.slice((page_number - 1) * page_size, page_number * page_size);
		},
		onRefreshPress: function (oEvent) {
			//refesh table ace cancel filling
			this.getModel("local").setProperty("/AceFilings", []);
			// Reset select entries
			this.getModel("local").setProperty("/modelData", [0]);
			this.getModel("local").setProperty("/Pagination", {
				Total: 0,
				nPage: 0,
				ncurrNum: 0
			});
			// reset input numner
			this.byId("idCancelNo").setValue("");
			// enable input numner
			this.byId("idCancelNo").setEditable(true);
			this.byId("idInputType").setEditable(true);
		},

		onChangeNum: function (oEvent) {
			this.showBusy();
			this.getModel().read("/AceCancelQuerySet", {
				filters: [
					new Filter("InputType", "EQ", this.sInputType),
					new Filter("InputId", "EQ", this.sInputId),
					new Filter("ProfileId", "EQ", this.sProfileId),
				],
				urlParameters: {
					"$expand": "Authenticate,Cancel_Data,Return"
				},
				success: function (oData) {
					var aData = oData.results[0].Cancel_Data.results;
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

		// When dropdown input type loaded
		onInputTypeLoaded: function () {
			this.byId("idInputType").setSelectedKey(this.sInputType);
			this.oInputTypeDeferred.resolve();
		},

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

		onCancelAceFiling: function () {
			//check authenticated 
			var bAuthenticated = this.getModel("local").getProperty("/UserVerified/Authenticate/Authenticated");
			if (!bAuthenticated) {
				this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
				this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
				this._oAuthenticate = Utils.getFragment(null, "Authenticate.PrivacyActStatement", this);
				this._oAuthenticate.open();
			} else {
				this._deleteAceFilingItem();
			}
		},

		_deleteAceFilingItem: function () {
			var oRequestPayload = this.generateDeleteAceFilingPayload();
			this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData) {
						var oPageModel = this.getView().getModel("local");
						if (oData.Return && oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						if (oData.Cancel_Data.results.length > 0) {
							oPageModel.setProperty("/UserVerified", oData);
							var totalItems = (oData.Cancel_Data.results).length;
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
								aFinalData = this.handlePagination(oData.Cancel_Data.results, iNumSelect, 1);
								oPageModel.setProperty("/AceFilings", aFinalData);
							}
						} else {
							oPageModel.setProperty("/AceFilings", []);
						}
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateDeleteAceFilingPayload: function () {
			var oAuth = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Process_Cancel",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuth,
				Cancel_Data: (oTableAce) ? oTableAce : [],
				InputId: this.sInputId,
				InputType: this.sInputType,
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
			this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						this.getModel("local").setProperty("/UserVerified", oData);
						this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
						this._TwoFactorAuthen = Utils.getFragment(null, "Authenticate.TwoFactorAuthenticate", this);
						this._TwoFactorAuthen.open();
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
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputType: this.sInputType,
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				InputId: this.sInputId,
				Cancel_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		// --- Confirm Authencation ---
		onConfirmAuthencation: function () {
			this.showBusy();
			var oRequestPayload = this.generateGetPrivacyActPayload();
			this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
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
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Get_Privacy_Act",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputType: this.sInputType,
				Privacy_Act: "",
				Authenticate: oAuth,
				InputId: this.sInputId,
				Cancel_Data: (oTableAce) ? oTableAce : [],
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
				this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
					success: function (oData) {
						if (oData.Return && oData.Return.results.length > 0) {
							var aMsg = this._generateMessages(oData.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
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
										this.getModel("local").setProperty("/UserVerified/Authenticate/TermsAccept", true);
										$.when(this._getAuthenticate()).done(function () {
											// Process delete ace filing item
											this._deleteAceFilingItem();
											// Close dialog
											oDialog.close();
											// Close two factor authenticate
											this._TwoFactorAuthen.close();
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
			this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData) {
						this.getModel("local").setProperty("/UserVerified", oData);
					}
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					if (oData.Cancel_Data.results.length > 0) {
						var oPageModel = this.getView().getModel("local");
						oPageModel.setProperty("/UserVerified", oData);
						var totalItems = (oData.Cancel_Data.results).length;
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
							aFinalData = this.handlePagination(oData.Cancel_Data.results, iNumSelect, 1);
							oPageModel.setProperty("/AceFilings", aFinalData);
						}
					} else {
						oPageModel.setProperty("/AceFilings", []);
					}
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
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				Cancel_Data: (oTableAce) ? oTableAce : [],
				Return: []
			};
			return oPayload;
		},

		generateVerifyPayload: function () {
			this.getModel("local").setProperty("/UserVerified/Authenticate/Verify", true);
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				InputId: this.sInputId,
				InputType: this.sInputType,
				Cancel_Data: (oTableAce) ? oTableAce : [],
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
						this._TwoFactorAuthen.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},

		// --- Resend Email ---
		onResendPress: function () {
			this.showBusy();
			this.getModel("local").setProperty("/UserVerified/Authenticate/Resend", true);
			// Remove token for resend authenticate
			this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
			var oRequestPayload = this.generateResendPayload();
			this.getModel().create("/AceCancelQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						this.getModel("local").setProperty("/UserVerified", oData);
						this.getModel("local").setProperty("/UserVerified/Authenticate/Resend", false);
					}

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
			var oTableAce = this.getModel("local").getProperty("/AceFilings");
			var oPayload = {
				Action: "CANCEL_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputType: this.sInputType,
				Privacy_Act: "",
				Authenticate: oAuthenticate,
				InputId: this.sInputId,
				Cancel_Data: (oTableAce) ? oTableAce : [],
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
						this._TwoFactorAuthen.close();
						MessageBox.information(this.oBundle.getText("authenticate"));
					}
				}.bind(this)
			});
			return;
		},

		onCancelParicacyAct: function () {
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