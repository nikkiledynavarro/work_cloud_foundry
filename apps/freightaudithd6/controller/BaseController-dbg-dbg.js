sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/Link",
	"sap/ui/core/MessageType",
	"sap/m/MessageBox",
	"sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, History, Filter, FilterOperator, MessagePopover, MessagePopoverItem, Link, MessageType, MessageBox,
	BusyIndicator) {
	"use strict";

	return Controller.extend("com.erpis.shiperp.freightaudit.hd6.hr7.controller.BaseController", {

		/**
		 * Convenience method for accessing the router.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */

		getRouter: function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		/**
		 * Convenience method for getting the view model by name.
		 * @public
		 * @param {string} [sName] the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Getter for the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		onNavBack: function () {
			var oHistory, sPreviousHash;
			oHistory = History.getInstance();
			sPreviousHash = oHistory.getPreviousHash();
			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				this.getRouter().navTo("invoiceList", {}, true /*no history*/ );
			}
		},

		/**
		 * Show/Hide global busy indicator
		 * @public
		 */
		hideBusy: function () {
			BusyIndicator.hide();
		},
		showBusy: function () {
			BusyIndicator.show(0);
		},

		checkSapUi5Version: function (oControl) {
			if (parseFloat(sap.ui.version) < 1.44) {
				oControl.addStyleClass("sapUiLargeMarginBottom");
			} else {
				oControl.removeStyleClass("sapUiLargeMarginBottom");
			}
		},

		/**
		 * Open Reversal Reason Dialog
		 * @public
		 */
		_getReversalReason: function (sDialogName, sIdTobeCreatedWithFragment) {
			this.showBusy();
			if (!this._oDialogReveraslReasons) {
				//If developer added the ID to include for Reversal Fragment
				if (sIdTobeCreatedWithFragment) {
					this._oDialogReveraslReasons = sap.ui.xmlfragment(sIdTobeCreatedWithFragment, sDialogName, this);
				} else {
					//If developer didn't add the ID to include for Reversal Fragment
					this._oDialogReveraslReasons = sap.ui.xmlfragment(sDialogName, this);
				}
				this.getView().addDependent(this._oDialogReveraslReasons);
			}
			this._oDialogReveraslReasons.getBinding("items").filter([]);
			this._oDialogReveraslReasons.open();
			this.hideBusy();
		},

		/**
		 * Handle the search box for Reversal dialog
		 * @public
		 */
		handleReversalReasonSearch: function (oEvent) {
			var oSelectDialog = oEvent.getSource();
			var sSearchValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new sap.ui.model.Filter("Code", FilterOperator.Contains, sSearchValue),
					new sap.ui.model.Filter("Description", FilterOperator.Contains, sSearchValue)
				],
				and: false
			});
			oSelectDialog.getBinding("items").filter(oFilter);
		},

		/********** MESSAGE POPOVER HANDLER *************/
		/* Handle Batch Response (Error + Success) */
		_handleBatchResponseHasError: function (oData) {
			if (oData.__batchResponses) {
				var aResponses = oData.__batchResponses;
				var bErrorFound = false;
				var oResponse, oError;
				for (var i = 0; i < aResponses.length; i++) {
					oResponse = aResponses[i];
					if (oResponse.response) {
						bErrorFound = true;
						oError = JSON.parse(oResponse.response.body);
						this._handleODataError(oError, true);
					} else {
						try {
							var oInfo = JSON.parse(oResponse.__changeResponses[0].headers["sap-message"]);
							this._addSuccessMessage(oInfo);
						} catch (exc) {
							jQuery.sap.log.info("Error while handling batch response");
						}
					}
				}
				if (bErrorFound) {
					if (this.byId("popoverButton")) {
						this.byId("popoverButton").firePress();
					} else {
						var sError = "";
						for (i = 0; i < this.getModel("messageModel").getProperty("/aMessages").length; i++) {
							if (this.getModel("messageModel").getProperty("/aMessages")[i].type === "Error") {
								sError += this.getModel("messageModel").getProperty("/aMessages")[i].title + "\n";
							}
						}
						MessageBox.error(sError);
					}
					return true;
				} else {
					return false;
				}
			} else {
				return true;
			}
		},
		_addSuccessMessage: function (oInfo) {
			var aInfoMessages = [{
				type: "Success",
				title: oInfo.message,
				description: "",
				counter: 0
			}];
			this._addMessage(aInfoMessages);
		},

		/**
		 * Handle Odata message. Continue parame = true -> do not open message popover.
		 * Read message from Gateway in response header (including Error + Success)
		 * @public
		 */
		_handleOdataResponse: function (oResponse, bContinue) {
			var bFound = false;
			var oMessage = JSON.parse(oResponse.headers['sap-message']);
			var aRawMessages = [];
			if (oMessage.details.length > 0) {
				aRawMessages = oMessage.details;
			} else {
				aRawMessages.push(oMessage);
			}
			// Add leading message to the list
			if (oMessage) {
				for (var i = 0; i < aRawMessages.length; i++) {
					if (aRawMessages[i].message === oMessage.message) {
						bFound = true;
						break;
					}
				}
				if (!bFound) {
					aRawMessages.push({
						code: oMessage.code,
						message: oMessage.message,
						severity: oMessage.severity,
						target: oMessage.target
					});
				}
			}

			var aMessages = this._generateMessages(aRawMessages);
			if (aMessages.length === 0) {
				return;
			}
			this._addMessage(aMessages);
			if (!bContinue) {
				if (this.byId("popoverButton")) {
					this.byId("popoverButton").firePress();
				} else {
					var sError = "";
					for (var i = 0; i < this.getModel("messageModel").getProperty("/aMessages").length; i++) {
						if (this.getModel("messageModel").getProperty("/aMessages")[i].type === "Error") {
							sError += this.getModel("messageModel").getProperty("/aMessages")[i].title + "\n";
						}
					}
					MessageBox.error(sError);
				}
			}
		},
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
				type: "Error",
				title: oPassMessage.message,
				description: oPassMessage.description || "",
				counter: 0
			};

			if (oPassMessage.message === "An exception was raised" ||
				oPassMessage.message === "Service provider did not return any business data" ||
				oPassMessage.message === "") {
				return null;
			}
			switch (oPassMessage.severity) {
			case "error":
				oMessage.type = MessageType.Error;
				break;
			case "warning":
				oMessage.type = MessageType.Warning;
				break;
			case "info":
				oMessage.type = MessageType.Information;
				break;
			case "success":
				oMessage.type = MessageType.Success;
				break;
			default:
				oMessage.type = MessageType.Warning;
				break;
			}

			return oMessage;
		},

		/**
		 * Handle Odata error. Continue parame = true -> do not open message popover.
		 * @public
		 */
		_handleODataError: function (oError, bContinue) {
			var aErrorMessage = [];
			try {
				var aMsgs = [];
				if (oError.responseText) {
					try {
						aMsgs = JSON.parse(oError.responseText).error.innererror.errordetails;
					} catch (ex) {
						aMsgs = [{
							message: oError.message,
							severity: "error"
						}];
					}
				} else if (oError.error) {
					aMsgs = oError.error.innererror.errordetails;
				} else if (Array.isArray(oError)) {
					aMsgs = oError;
				}

				aErrorMessage = this._generateMessages(aMsgs);
				if (aErrorMessage.length === 0) {
					return;
				}
				this._addMessage(aErrorMessage);
				if (!bContinue) {
					// Sometime we don't have a Message Icon button on the bottom left corner -> show on MessageBox
					if (this.byId("popoverButton")) {
						this.byId("popoverButton").firePress();
					} else {
						var sError = "";
						for (var i = 0; i < this.getModel("messageModel").getProperty("/aMessages").length; i++) {
							if (this.getModel("messageModel").getProperty("/aMessages")[i].type === "Error") {
								sError += this.getModel("messageModel").getProperty("/aMessages")[i].title + "\n";
							}
						}
						MessageBox.error(sError);
					}
				}
			} catch (exc) {
				jQuery.sap.log.info("Error while handling message return");
			}
		},

		/**
		 * @public
		 */
		_addMessage: function (aMsg) {
			var aMessages = this.getModel("messageModel").getProperty("/aMessages");
			var aNewMessages = aMsg.concat(aMessages);
			this.getModel("messageModel").setProperty("/messagesLength", aNewMessages.length);
			this.getModel("messageModel").setProperty("/aMessages", aNewMessages);
		},

		/**
		 * Clear Popover message for specific screen
		 * @public
		 */
		_clearMessages: function () {
			this.getModel("messageModel").setProperty("/aMessages", []);
			this.getModel("messageModel").setProperty("/messagesLength", 0);
			this._getMessagePopover().destroy();
			this._messagePopover = null;
		},

		/**
		 * Event clicking on the message popover button
		 * @public
		 */
		handleMessagePopoverPress: function (oEvent) {
			var oMessagePopover = this._getMessagePopover();
			oEvent.getSource().addDependent(oMessagePopover);
			oMessagePopover.openBy(oEvent.getSource());
		},

		/**
		 * Get current instance of MessagePopover from a view
		 * @public
		 */
		_getMessagePopover: function () {
			if (!this._messagePopover) {
				this._messagePopover = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hd6.hr7.fragment.MessagePopover", this);
			}
			this._messagePopover.setModel(this.getModel("messageModel"), "messageModel");
			return this._messagePopover;
		}

	});

});