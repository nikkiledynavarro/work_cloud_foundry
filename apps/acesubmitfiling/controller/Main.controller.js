/*global location*/
sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/ACESubmitFiling/controller/BaseController",
	"com/erpis/shiperp/ACESubmitFiling/model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"com/erpis/shiperp/ACESubmitFiling/common/Utils",
	"com/erpis/shiperp/ACESubmitFiling/common/ContentTermsHtml",
], function (library, BaseController, formatter, JSONModel, Token, Filter, MessageBox, MessageToast, Fragment, Utils, ContentTermsHtml) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.ACESubmitFiling.controller.Main", {

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
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			this.setModel(new JSONModel({}), "local");
			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.structureData = {
				template: {
					Name: "",
					Process: {
						Load: false,
						Save: false,
						Delete: false
					}
				}
			};
			//***  Verify Auhthenticate
			var oModel = new JSONModel({
				Authenticated: false
			});
			this.setModel(oModel, "Auhthenticate");

			//*** add checkbox validator
			this.getView().byId("txtId").addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});

			this.setModel(oJSONModel, "messageModel");
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
			this.sDelivery = oEvent.getParameter("arguments").Delivery;
			this.sInputType = this.byId("idInputType").getSelectedKey();
			this._getInputType().done(function () {
				this.getModel("local").setProperty("/AceSubmit", true);
				if (this.sDelivery) {
					this._getDelivery(this.sDelivery, this.sProfileId);
					this.byId("idInputType").setEditable(false);
					this.byId("txtId").setEditable(false);
				} else {
					this.hideBusy();
				}
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		_getInputType: function () {
			var oDeferred = $.Deferred();
			this.getModel().read("/xSERPERPxCDS_INPUT_TYPE", {
				success: function (oData) {
					this.getModel("local").setProperty("/InputTypes", oData.results);
					oDeferred.resolve();
				}.bind(this),
				error: function () {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_getDelivery: function (sDelivery, sProfileId) {
			this.byId("txtId").setValue(sDelivery);
			var sPath = "/AceSubmitQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("ProfileId", "EQ", sProfileId),
					new Filter("InputId", "EQ", sDelivery),
					new Filter("InputType", "EQ", "A1")
				],
				urlParameters: {
					"$expand": "Authenticate,Submit_Data/LineItems,Return"
				},
				success: function (oData) {
					if (oData.results.length > 0) {
						var adata = oData.results[0];
						this.getModel("local").setProperty("/UserVerified", adata);
						this.getModel("local").setProperty("/template", adata.Submit_Data.template);
						this.getModel("local").setProperty("/basic", adata.Submit_Data.basic);
						this.getModel("local").setProperty("/LineItems", adata.Submit_Data.LineItems.results);
						// check submitted 
						if (adata.Return && adata.Return.results.length > 0) {
							this.getModel("local").setProperty("/AceSubmit", true);
							// Table row mode None
							this.getModel("local").setProperty("/Mode", "None");
						} else {
							this.getModel("local").setProperty("/AceSubmit", false);
							// Table row mode SingleSelectLeft
							this.getModel("local").setProperty("/Mode", "SingleSelectLeft");
						}

						if (adata.Return && adata.Return.results.length > 0) {
							this.getModel("local").setProperty("/AceSubmit", true);
							var aMsg = this._generateMessages(adata.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						var oDeferredAll = this._getBindingCDSViews();
						oDeferredAll.done(function () {
							this.hideBusy();
						}.bind(this));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onScanNumber: function (oEvent) {
			this.showBusy();
			this.byId("idInputType").setEditable(false);
			// this.byId("ObjectPageLayout").scrollToSection(this.byId("idTabSection").getId());
			if (this.byId("idInputType").getSelectedKey() !== "") {
				this.sInputType = this.byId("idInputType").getSelectedKey();
				this.byId("idInputType").setValueState("None");
			} else {
				MessageBox.error(this.oBundle.getText("missingInputType"));
				this.byId("idInputType").setValueState("Error");
				this.hideBusy();
				return;
			}

			this.byId("txtId").setEditable(false);
			if (oEvent.getSource().getTokens().length === 0 && oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("idInputType").setEditable(true);
				this.byId("txtId").setEditable(true);
				this.byId("txtId").setValueState("Error");
				this.hideBusy();
				return;
			} else {
				this.byId("txtId").setValueState("None");
			}

			this.sInputIds = "";
			if (oEvent.getSource().getTokens().length > 0) {
				for (var i = 0; i < oEvent.getSource().getTokens().length; i++) {
					var sTokenValue = oEvent.getSource().getTokens()[i].getText();
					this.sInputIds += sTokenValue;
				}
			} else {
				this.sInputIds = oEvent.getSource().getValue();
			}

			var sPath = "/AceSubmitQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("ProfileId", "EQ", this.sProfileId),
					new Filter("InputId", "EQ", this.sInputIds),
					new Filter("InputType", "EQ", this.sInputType),
				],
				urlParameters: {
					"$expand": "Authenticate,Submit_Data/LineItems,Return"
				},
				success: function (oData) {
					if (oData.results.length > 0) {
						var adata = oData.results[0];
						this.getModel("local").setProperty("/UserVerified", adata);
						this.getModel("local").setProperty("/template", adata.Submit_Data.template);
						this.getModel("local").setProperty("/basic", adata.Submit_Data.basic);
						this.getModel("local").setProperty("/LineItems", adata.Submit_Data.LineItems.results);
						// check submitted 
						if (adata.Return && adata.Return.results.length > 0) {
							this.getModel("local").setProperty("/AceSubmit", true);
							// Table row mode None
							this.getModel("local").setProperty("/Mode", "None");
						} else {
							this.getModel("local").setProperty("/AceSubmit", false);
							// Table row mode SingleSelectLeft
							this.getModel("local").setProperty("/Mode", "SingleSelectLeft");
						}

						if (adata.Return && adata.Return.results.length > 0) {
							this.getModel("local").setProperty("/AceSubmit", true);
							var aMsg = this._generateMessages(adata.Return.results);
							this._addMessage(aMsg);
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
						var oDeferredAll = this._getBindingCDSViews();
						oDeferredAll.done(function () {
							this.hideBusy();
						}.bind(this));
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_getBindingCDSViews: function () {
			var oDeferredAll = $.Deferred();
			// Get States
			var oDeferredStates = this._getStates();
			// Get Carrier
			var oDeferredCarrier = this._getCarrier();
			$.when(oDeferredStates, oDeferredCarrier).done(function () {
				oDeferredAll.resolve();
			});
			return oDeferredAll;
		},

		_getStates: function () {
			var oDeferred = $.Deferred();
			var sCountry = this.getModel("local").getProperty("/basic").partners.ultimate_consignee.Ad112;
			this.getModel().read("/xSERPERPxCDS_STATE", {
				filters: [
					new Filter("Land1", "EQ", sCountry),
				],
				success: function (oData) {
					this.getModel("local").setProperty("/States", oData.results);
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_getCarrier: function () {
			var oDeferred = $.Deferred();
			this.byId("idCarrier").setBusy(true);
			this.getModel().read("/xSERPERPxCDS_SCACT", {
				urlParameters: {
					"$top": 9999
				},
				success: function (oData) {
					this.getModel("local").setProperty("/Carrieres", oData.results);
					this.byId("idCarrier").setBusy(false);
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		onInputTypeChange: function (oEvent) {
			this.onResetData();
		},

		// Reset button click
		onResetData: function () {
			this.showBusy();
			this.byId("ObjectPageLayout").scrollToSection(this.byId("idInputType").getId());
			setTimeout(this._resetData.bind(this), 1000); //eslint-disable-line
		},

		// Reset whole screen data
		_resetData: function () {
			this.byId("txtId").removeAllTokens();
			// // Enable inputs fields
			this.byId("txtId").setEditable(true);
			this.getModel("local").setData({});
			this.byId("idInputType").setEditable(true);
			this.byId("ObjectPageLayout").setShowHeaderContent(false);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(false);
			this._getInputType().done(function () {
				this.hideBusy();
			}.bind(this));
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
		onSubmit: function (oEvent) {
			//check authenticated 
			var bAuthenticated = this.getModel("Auhthenticate").getProperty("/Authenticated");
			if (!bAuthenticated) {
				this.getModel("local").setProperty("/UserVerified/Authenticate/Token", "");
				this.getModel("local").setProperty("/UserVerified/Authenticate/ContinueLogin", false);
				this._oAuthenticate = Utils.getFragment(null, "Authenticate.PrivacyActStatement", this);
				this._oAuthenticate.open();
			} else {
				this._submitData();
			}
		},

		_submitData: function () {
			this.showBusy();
			var oRequestPayload = this._generateSubmitPayload();
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					this.getModel("local").setProperty("/UserVerified", oData);
					this.getModel("local").setProperty("/template", oData.Submit_Data.template);
					this.getModel("local").setProperty("/basic", oData.Submit_Data.basic);
					this.getModel("local").setProperty("/LineItems", oData.Submit_Data.LineItems.results);
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateSubmitPayload: function () { // Set return for authenticate process 
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var aConditonTables = this.getModel("local").getProperty("/ConditionTables");
			var aALVRateAnalysis = this.getModel("local").getProperty("/ALVRateAnalysis");
			var aAnalysis = this.getModel("local").getProperty("/StructureAnalysis/Analysis/results");
			var oPayload = {
				Action: "SUBMIT_Process_Submit",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: this.getModel("local").getProperty("/UserVerified/Authenticate"),
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : [],
					Analysis: {
						Bizrule: [],
						Analysis: (aAnalysis) ? aAnalysis : [],
						Alv: (aALVRateAnalysis) ? aALVRateAnalysis : [],
						ConditonTables: (aConditonTables) ? aConditonTables : []
					}
				},
				Return: []
			};
			return oPayload;
		},

		// --- Confirm Authencation ---
		onConfirmAuthencation: function () {
			this.showBusy();
			var oRequestPayload = this.generateGetPrivacyActPayload();
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
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
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Get_Privacy_Act",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Privacy_Act: "",
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : []
				},
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
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
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
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : []
				},
				Return: []
			};
			return oPayload;
		},

		// --- Verify Authenticate ---
		onVerifyPress: function () {
			var sValue = this.getModel("local").getProperty("/UserVerified/Authenticate/Token");
			if (sValue !== "") {
				this.showBusy();
				this.getModel("local").setProperty("/UserVerified/Authenticate/Verify", true);
				var oRequestPayload = this.generateVerifyPayload();
				this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
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
											// Process delete ace filing item
											this._submitData();
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
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
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
						// verify auhthenticate
						this.getModel("Auhthenticate").setProperty("/Authenticated", oData.Authenticate.Authenticated);
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
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/TermsAccept", true);
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : []
				},
				Return: []
			};
			return oPayload;
		},

		generateVerifyPayload: function () {
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : []
				},
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
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0)
							this.byId('popoverButton').firePress();
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
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Authenticate",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : []
				},
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

		// Line Items
		onSearchItem: function (oEvent) {
			var sValue = oEvent.getSource().getValue().trim();
			var aFilters = [];
			if (sValue.length > 0) {
				var oFilter = new Filter({
					filters: [new Filter("Itx1", "Contains", sValue)],
					and: false,
				});
				aFilters.push(oFilter);
			}
			this.byId("LineItems").getBinding("items").filter(aFilters);
		},

		onAddLineItems: function () {
			var oData = {
				FillingRequired: false,
				Itx13: "",
				Itx12: "",
				Itx1: "",
				Itx2: "",
				Currency: "",
				Itx4: "",
				Itx3: ""
			};
			this._oAddLineItems = Utils.getFragment(null, "LineItems.AddLineItems", this);
			this._oAddLineItems.setModel(new JSONModel(oData), "NewLineItems");
			this._oAddLineItems.open();
		},

		onClose: function () {
			this._oAddLineItems.close();
		},

		onCreateLineItems: function () {
			var aData = this.getModel("local").getProperty("/LineItems");
			var oNewLineItems = this._oAddLineItems.getModel("NewLineItems").getData();
			aData.push(oNewLineItems);
			this.getModel("local").setProperty("/LineItems", aData);
			this.getModel("local").refresh(true);
			this._oAddLineItems.close();
		},

		onEditPress: function () {
			this.getModel("local").setProperty("/CheckEditLineitem", true);
			var oSlected = this.getModel("local").getProperty("/SelectedLineItems");
			this._oDettailLineItems = Utils.getFragment(null, "LineItems.DetailLineItems", this);
			this._oDettailLineItems.setModel(new JSONModel(oSlected), "DetailLineItems");
			this._oDettailLineItems.open();
		},

		// change Line Items
		onChangeLineItems: function () {
			var aData = [];
			var aLineItem = this.getModel("local").getProperty("/LineItems");
			var oObjectLineItem = this._oDettailLineItems.getModel("DetailLineItems").getData();
			aLineItem.forEach(function (obj) {
				if (obj.Posnr === oObjectLineItem.Posnr) {
					aData.push(oObjectLineItem);
				} else {
					aData.push(obj);
				}
			});
			var oRequestPayload = this.generateEditLineItemsPayload(aData);
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					this.getModel("local").setProperty("/LineItems", oData.Submit_Data.LineItems.results);
					if (oData.Return && oData.Return.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this._oDettailLineItems.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onValidateInput: function (oEvent) {
			var oObjectLineItem = this._oDettailLineItems.getModel("DetailLineItems").getData();
			var sValue = oEvent.getSource().getValue();
			var sId = oEvent.getSource().getId().split("--").pop()
			var fieldIds = {
				Islinex: "idLineItem",
				Vbeln: "idDelivery",
				Posnr: "idDeliveryItem",
				Matnr: "idMaterNo",
				Maktx: "idMaterDes",
				Itx2: "idUsDollar",
				Itx4: "idFirQuan",
				Itx3: "idFirUnitMean",
				Itx6: "idSecQuan",
				Itx5: "idSecUnitMean",
				Itx7: "idWeight",
				Itx9: "idLicenNum",
				Itx10: "idLicenVal",
				Itx12: "idDes",
				Itx13: "idComCode",
				Itx14: "idMarNum",
				Itx15: "idVehFlag",
				Itx17: "idVehId",
				Itx18: "idVehTitle",
				Itx19: "idVehTitleSta",
				Itx20: "idEccn",
				Itx21: "idOrigin",
				Odtcx1: "idExeNum",
				Odtcx2: "idRegisNum",
				Odtcx3: "idMiliEquip",
				Odtcx4: "idParCerti",
				Odtcx5: "idCateCode",
				Odtcx6: "idUnitMean",
				Odtcx7: "idDDTCQuantity",
				ItemGroup: "idItemGroup",
				Currency: "idCurrency"
			};
			for (var key in fieldIds) {
				if (fieldIds.hasOwnProperty(key)) {
					if (oObjectLineItem.hasOwnProperty(key)) {
						if (key === "Islinex" && sId === fieldIds[key] && sValue.length > 1) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Vbeln" && sId === fieldIds[key] && sValue.length > 10) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Posnr" && sId === fieldIds[key] && sValue.length > 6) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Matnr" && sId === fieldIds[key] && sValue.length > 18) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Maktx" && sId === fieldIds[key] && sValue.length > 40) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx2" && sId === fieldIds[key] && sValue.length > 15) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx4" && sId === fieldIds[key] && sValue.length > 15) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx3" && sId === fieldIds[key] && sValue.length > 3) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx6" && sId === fieldIds[key] && sValue.length > 15) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx5" && sId === fieldIds[key] && sValue.length > 3) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx7" && sId === fieldIds[key] && sValue.length > 15) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx9" && sId === fieldIds[key] && sValue.length > 3) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx10" && sId === fieldIds[key] && sValue.length > 12) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx12" && sId === fieldIds[key] && sValue.length > 10) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx13" && sId === fieldIds[key] && sValue.length > 3) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx14" && sId === fieldIds[key] && sValue.length > 75) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx15" && sId === fieldIds[key] && sValue.length > 1) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx17" && sId === fieldIds[key] && sValue.length > 25) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx18" && sId === fieldIds[key] && sValue.length > 15) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx19" && sId === fieldIds[key] && sValue.length > 2) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx20" && sId === fieldIds[key] && sValue.length > 5) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Itx21" && sId === fieldIds[key] && sValue.length > 1) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx1" && sId === fieldIds[key] && sValue.length > 12) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx2" && sId === fieldIds[key] && sValue.length > 6) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx3" && sId === fieldIds[key] && sValue.length > 1) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx4" && sId === fieldIds[key] && sValue.length > 1) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx5" && sId === fieldIds[key] && sValue.length > 2) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx6" && sId === fieldIds[key] && sValue.length > 3) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Odtcx7" && sId === fieldIds[key] && sValue.length > 7) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "ItemGroup" && sId === fieldIds[key] && sValue.length > 6) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else if (key === "Currency" && sId === fieldIds[key] && sValue.length > 5) {
							this.byId(fieldIds[key]).setValueState("Error");
						} else {
							this.byId(fieldIds[key]).setValueState("None");
						}
					}
				}
			}
		},

		generateEditLineItemsPayload: function (UpdateLineItemData) {
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var oPayload = {
				Action: "SUBMIT_Change_LineItem",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (UpdateLineItemData) ? UpdateLineItemData : []
				},
				Return: []
			};
			return oPayload;
		},

		onSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();

			var aData = this.getModel("local").getProperty("/LineItems");
			var oSelected = oTab.getSelectedItem().getBindingContext("local").getObject();
			// set flag for seleted
			var SlectedLineItemData = aData.map(function (obj) {
				if (obj.Posnr === oSelected.Posnr) {
					obj.Selected = true;
				} else {
					obj.Selected = false;
				}
				return obj.Posnr === oSelected.Posnr ? oSelected : obj;
			});

			oSelected.Selected = true;
			// Enable Edit Button
			this.getModel("local").setProperty("/EnableEditButton", true);
			this.getModel("local").setProperty("/SelectedLineItems", oSelected);
			this.getModel("local").setProperty("/LineItems", SlectedLineItemData);
		},

		onDeletePress: function () {
			var aData = this.getModel("local").getProperty("/LineItems");
			var oTable = this.byId("LineItems");
			var aSelectedItem = oTable.getSelectedItems();
			if (aSelectedItem.length > 0) {
				var aFilterData = aData.filter(function (item) {
					return !aSelectedItem.some(function (selectedItem) {
						return selectedItem.getBindingContext("local").getObject() === item;
					});
				});
				this.getModel("local").setProperty("/LineItems", aFilterData);
			} else {
				MessageBox.error(this.oBundle.getText("Please select at least one line item"));
			}
		},

		onAnalysisClick: function () {
			var oRequestData = this._generateAnalysisUsecase();
			this.showBusy();
			this.getModel().create("/AceSubmitQuerySet", oRequestData, {
				success: function (oData) {
					var aDataAnalysis = oData.Submit_Data.Analysis;
					try {
						this.getModel("local").setProperty("/Bizrules", aDataAnalysis.Bizrule.results);
					} catch (exc) {
						this.getModel("local").setProperty("/Bizrules", []);
						this.oLogger.info("No Carrier Rate Analysis");
					}
					if (oData.ReturnSet && oData.ReturnSet.results.length > 0) {
						var aMsg = this._generateMessages(oData.ReturnSet.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					// Alv
					if (oData.Submit_Data.Analysis.Alv) {
						this.getModel("local").setProperty("/ALVRateAnalysis", aDataAnalysis.Alv.results);
					}
					// ConditonTables
					if (oData.Submit_Data.Analysis.ConditonTables) {
						this.getModel("local").setProperty("/ConditionTables", aDataAnalysis.ConditonTables.results);
					}
					// Analysis
					if (oData.Submit_Data.Analysis.Analysis) {
						this.getModel("local").setProperty("/StructureAnalysis", aDataAnalysis);
					}
					if (!this.oAnalysisDialog) {
						this.oAnalysisDialog = Utils.getFragment(null, "Analysis.AnalysisDialog", this);
						this.oAnalysisDialog.open();
					} else {
						this.oAnalysisDialog.open();
					}
					this.getModel("local").setProperty("/ConditionTableVisible", false)
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateAnalysisUsecase: function () {
			// Set return for authenticate process
			this.getModel("local").setProperty("/UserVerified/Authenticate/Return", []);
			var oAuthenticate = this.getModel("local").getProperty("/UserVerified/Authenticate");
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Get_Analysis",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Authenticate: oAuthenticate,
				Submit_Data: {
					basic: this.getModel("local").getProperty("/basic"),
					LineItems: (aLineItems) ? aLineItems : [],
					Analysis: {
						Bizrule: [],
						Analysis: [],
						Alv: [],
						ConditonTables: []
					}
				},
				Return: []
			};
			return oPayload;
		},

		onCloseAnalysisDialog: function () {
			this.oAnalysisDialog.close();
		},
		onAnalysisData: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},

		onAfterRateAnalysisOpen: function () {
			var aAnalysis = this.getModel("local").getProperty("/Bizrules");
			try {
				this.getModel("local").setProperty("/CarrierRateAnalysis", this.treeify(aAnalysis, "Node", "ParentNode"));
			} catch (exc) {
				this.getModel("local").setProperty("/CarrierRateAnalysis", []);
				this.oLogger.info("No Carrier Rate Analysis");
			}
		},

		onChangeRateAnalysisLine: function (oEvent) {
			var oObject = oEvent.getParameter("rowContext").getObject();
			this.getModel("local").setProperty("/ConditionLabel", oObject.Condition);
			this.getModel("local").setProperty("/ConditionTableVisible", true);
			var ALV = this.getModel("local").getProperty("/ALVRateAnalysis");
			var oTitle = this.byId("txtTabDesc");
			oTitle.setText(oObject.Description);
			if (this.analyRequest) {
				this.analyRequest.abort();
			}
			var aDataToFields = [];
			ALV.forEach(function (item) {
				if (item.Node === oObject.Node) {
					aDataToFields.push(item);
				}
			});
			var aFilterDataFound = aDataToFields.filter(function (item) {
				return item.Text2 === "Data Found";
			});
			var aConditionTable = [];
			var aResultTable = [];
			var bCheckDataFound = false;
			for (var i = 0; i < aDataToFields.length; i++) {
				var Value = aDataToFields[i].Text1;
				if (aFilterDataFound.length > 0) {
					if (aDataToFields[i].Text2 === "Data Found") {
						var bCheckDataFound = true;
					} else {
						if (!bCheckDataFound) {
							aConditionTable.push(aDataToFields[i]);
						}
					}
					if (bCheckDataFound) {
						if (aDataToFields[i].Result === "X") {
							aResultTable.push(aDataToFields[i]);
						}
					}
				} else {
					aConditionTable.push(aDataToFields[i]);
				}
			}
			this._DynamicTable(aConditionTable, "dynamicConditionTable");
			this._DynamicTable(aResultTable, "dynamicResultTable");
		},

		_DynamicTable: function (aData, idTable) {
			var oTable = this.byId(idTable);
			oTable.removeAllColumns();
			var unique = [];
			var rowData = {};
			for (var i = 0; i < aData.length; i++) {
				var sDesc = aData[i].Text2;
				if (unique.indexOf(sDesc) === -1) {
					unique.push(sDesc);
				}
				if (!rowData[sDesc]) {
					rowData[sDesc] = aData[i].Text3;
				}
			}
			this.getModel("local").setProperty("/DataToFields", [rowData]);
			unique.forEach(function (sDescription) {
				oTable.addColumn(new sap.m.Column({
					header: new sap.m.Text({
						text: sDescription
					}),
					hAlign: sap.ui.core.TextAlign.Center
				}));
			});
			var oTemplate = new sap.m.ColumnListItem({
				cells: aData.map(function (oData) {
					return new sap.m.Text({
						text: oData.Text3
					});
				})
			});
			oTable.bindItems({
				path: "local>/DataToFields",
				template: oTemplate
			});
		},

		onConditonAnalysisDialog: function () {
			var sSelectedRow = this.byId("tableRateAnalysis").getSelectedIndices();
			if (!sSelectedRow || sSelectedRow.length === 0) {
				MessageBox.error(this.oBundle.getText("missingItemToshowsolidation"));
				return;
			}
			// var sCondition = this.byId("tableRateAnalysis").getRows()[sSelectedRow].getBindingContext("local").getObject();
			if (!this.oConditionTablesDialog) {
				this.oConditionTablesDialog = Utils.getFragment(null, "Analysis.ConditionTablesDialog", this);
				this.oConditionTablesDialog.open();
			} else {
				this.oConditionTablesDialog.open();
			}
		},

		onconDitionTableClose: function () {
			this.oConditionTablesDialog.close();
		},

		// --------------------------- Overwrite Template ----------------------
		onSaveOverwriteTemplate: function () {
			this.SaveAsTemplate();
			this.overwriteExistingTemplate.close();
		},
		// Close Overwrite template
		onCloseTemplate: function () {
			this.overwriteExistingTemplate.close();
		},
		// Cancel Overwrite Template
		onCancelOverwriteTemplate: function () {
			this.overwriteExistingTemplate.close();
		},

		//---------------------------------------  Load Template  ----------------------------

		onLoadTemplate: function () {
			var selected = this.byId("idLoadTemplate").getSelectedItem();
			if (selected) {
				this.showBusy();
				var oRequestPayload = this.generateLoadingTemplatePayload();
				this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
					success: function (oData) {
						//Handle response here
						this.getModel("local").setProperty("/template/Process/Load", false);
						if (oData) {
							this.getModel("local").setProperty("/UserVerified", oData);
							this.getModel("local").setProperty("/template", oData.Submit_Data.template);
							this.getModel("local").setProperty("/basic", oData.Submit_Data.basic);
							this.getModel("local").setProperty("/LineItems", oData.Submit_Data.LineItems.results);
							this.getModel("local").setProperty("/template/Process/Load", false);
							if (oData.Return && oData.Return.results.length > 0) {
								var aMsg = this._generateMessages(oData.Return.results);
								this._addMessage(aMsg);
								if (aMsg.length > 0) this.byId('popoverButton').firePress();
							}

							this.oLoadingTemplate.close();
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				MessageBox.error(this.oBundle.getText("Please select at least one template"));
			}

		},

		generateLoadingTemplatePayload: function () {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			this.getModel("local").setProperty("/template/Process/Load", true);
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Process_Template",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: (this.sInputIds) ? this.sInputIds : "",
				InputType: (this.sInputType) ? this.sInputType : "",
				Submit_Data: {
					basic: (this.getModel("local").getProperty("/basic")) ? this.getModel("local").getProperty("/basic") : {},
					template: (this.getModel("local").getProperty("/template")) ? this.getModel("local").getProperty("/template") : {},
					LineItems: (aLineItems) ? aLineItems : []
				},
				Return: []
			};
			return oPayload;
		},

		// Cancel Loading Template
		onCancelLoadTemplate: function () {
			this.oLoadingTemplate.close();
		},

		// Selection template
		onSelectionTemplate: function (oEvent) {
			this.getModel("local").setProperty("/template", this.structureData.template);
			var sSelected = oEvent.getSource().getSelectedItem().getBindingContext().getObject();
			this.getModel("local").setProperty("/template/Name", sSelected.Template);
		},

		// open load template
		onLoadingTemplateDialog: function () {
			this.oLoadingTemplate = Utils.getFragment(null, "Template.LoadingTemplate", this);
			this.oLoadingTemplate.open();
		},

		//----------------------------------------- Save As Template -------------------------------
		onSaveACEClick: function () {
			this.getModel("local").setProperty("/template", this.structureData.template);
			this.oSaveAsTemplate = Utils.getFragment(null, "Template.SaveAsTemplate", this);
			this.oSaveAsTemplate.open();
		},

		onCancelTemplate: function () {
			this.oSaveAsTemplate.close();
		},

		onCancelTemplatePress: function () {
			this.oSaveAsTemplate.close();
		},

		onSaveAsTemplate: function (oEvent) {
			var sValue = this.getModel("local").getProperty("/template/Name");
			if (sValue !== "") {
				this.getModel().read("/xSERPERPxCDS_TEMPLATE", {
					success: function (oData) {
						this.getModel("local").setProperty("/ListTemplate", oData.results);
						var exists = oData.results.some(function (item) {
							return item.Template === sValue;
						});
						if (exists) {
							this.overwriteExistingTemplate = Utils.getFragment(null, "Template.OverwriteExistingTemplate", this);
							this.overwriteExistingTemplate.open();
						} else {
							this.SaveAsTemplate();
						}
						this.oSaveAsTemplate.close();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				MessageBox.error(this.oBundle.getText("Please enter template"));
			}
		},

		SaveAsTemplate: function () {
			this.showBusy();
			var oRequestPayload = this.generateSaveAsTemplatePayload();
			this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
				success: function (oData) {
					//Handle response here
					if (oData) {
						this.getModel("local").setProperty("/template/Process/Save", false);
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateSaveAsTemplatePayload: function () {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			this.getModel("local").setProperty("/template/Process/Save", true);
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Process_Template",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Submit_Data: {
					basic: (this.getModel("local").getProperty("/basic")) ? this.getModel("local").getProperty("/basic") : {},
					template: (this.getModel("local").getProperty("/template")) ? this.getModel("local").getProperty("/template") : {},
					LineItems: (aLineItems) ? aLineItems : []
				},
				Return: []
			};
			return oPayload;
		},

		SelectionTemplate: function (oEvent) {

		},

		handleCommodityCodePress: function (oEvent) {
			this.getModel("local").setProperty("/CheckEditLineitem", false);
			var oSelectedCommodiy = oEvent.getSource().getBindingContext("local").getObject();
			this._oDettailLineItems = Utils.getFragment(null, "LineItems.DetailLineItems", this);
			this._oDettailLineItems.setModel(new JSONModel(oSelectedCommodiy), "DetailLineItems");
			this._oDettailLineItems.open();
		},

		onCloseDetailLineItems: function (oEvent) {
			this._oDettailLineItems.close();
		},

		// Retrieve from Database

		onRetrieveDatabase: function () {
			MessageBox.warning(this.oBundle.getText("Do you want to revert all the manual changes you made to the document?"), {
				title: "Warning",
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (sAction) {
					if (sAction === "NO") {
						return;
					} else if (sAction === "YES") {
						this.showBusy();
						var oRequestPayload = this.generateRetrieveDatabasePayload();
						this.getModel().create("/AceSubmitQuerySet", oRequestPayload, {
							success: function (oData) {
								//Handle response here
								if (oData) {
									this.getModel("local").setProperty("/basic", oData.Submit_Data.basic);
									this.getModel("local").setProperty("/LineItems", oData.Submit_Data.LineItems.results);
									if (oData.Return.results.length > 0) {
										var aMsg = this._generateMessages(oData.Return.results);
										this._addMessage(aMsg);
										if (aMsg.length > 0) this.byId('popoverButton').firePress();
									}

								}
								this.hideBusy();
							}.bind(this),
							error: function (oError) {
								this._handleODataError(oError);
								this.hideBusy();
							}.bind(this)
						});
					}
				}.bind(this)
			});
		},

		generateRetrieveDatabasePayload: function () {
			this.sInputType = this.byId("idInputType").getSelectedKey();
			this.getModel("local").setProperty("/template/Process/Save", true);
			var aLineItems = this.getModel("local").getProperty("/LineItems");
			var oPayload = {
				Action: "SUBMIT_Retrieve_from_Database",
				ProfileId: (this.sProfileId) ? this.sProfileId : "",
				InputId: this.sInputIds,
				InputType: this.sInputType,
				Submit_Data: {
					basic: (this.getModel("local").getProperty("/basic")) ? this.getModel("local").getProperty("/basic") : {},
					template: (this.getModel("local").getProperty("/template")) ? this.getModel("local").getProperty("/template") : {},
					LineItems: (aLineItems) ? aLineItems : []
				},
				Return: []
			};
			return oPayload;
		},

		onSearchTemplate: function (oEvent) {
			var sValue = oEvent.getSource().getValue().trim();
			var aFilters = [];
			if (sValue.length > 0) {
				var oFilter = new Filter({
					filters: [new Filter("Template", "EQ", sValue)],
					and: false,
				});
				aFilters.push(oFilter);
			}
			this.byId("idLoadTemplate").getBinding("items").filter(aFilters);
		},

		/* --------------------Handle Message ------------------*/
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
	});
});