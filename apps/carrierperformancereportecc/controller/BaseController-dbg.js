sap.ui.define([
	"sap/ui/core/library",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
], function (library, Controller, JSONModel, History, BusyIndicator, MessageBox, MessagePopover, MessagePopoverItem) {
	"use strict";

	var library = library.MessageType;

	return Controller.extend("com.erpis.shiperp.carrierperformancereportecc.controller.BaseController", {

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

		_getControlById: function (sCtrlId) {
			var oCtrl = this.getView().byId(sCtrlId);
			if (!oCtrl) {
				oCtrl = sap.ui.getCore().byId(sCtrlId);
			}
			return oCtrl;
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

		onInitCreatedOn: function (oEvent) {
			var oDate = new Date();
			var dateFrom = new Date();
			var dateTo = new Date();
			dateTo.setUTCDate(oDate.getDate());
			dateTo.setUTCMonth(oDate.getMonth());
			dateTo.setUTCFullYear(oDate.getFullYear());
			dateFrom.setUTCDate(oDate.getDate());
			dateFrom.setUTCMonth(oDate.getMonth() - 1);
			dateFrom.setUTCFullYear(oDate.getFullYear());
			var oCreatedOn = this.byId("dateCreatedOn");
			oCreatedOn.setDateValue(dateFrom);
			oCreatedOn.setSecondDateValue(dateTo);
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

						if (JSON.parse(oError.responseText).error.innererror.errordetails) {
							aMsgs = JSON.parse(oError.responseText).error.innererror.errordetails;
						} else {
							aMsgs = JSON.parse(oError.responseText).error.message.value;
						}
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
				this._messagePopover = sap.ui.xmlfragment("com.erpis.shiperp.carrierperformancereportecc.fragment.MessagePopover", this);
			}
			this._messagePopover.setModel(this.getModel("messageModel"), "messageModel");
			return this._messagePopover;
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

	});
});