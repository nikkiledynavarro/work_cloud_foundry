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

	return Controller.extend("com.erpis.shiperp.dispute.hd6.controller.BaseController", {

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
				this.getRouter().navTo("disputeList", {}, true /*no history*/ );
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
							this._handleODataSuccessMessage(oInfo);
						} catch (exc) {
							// 
						}
					}
				}
				if (bErrorFound) {
					this.byId("popoverButton").firePress();
					return true;
				} else {
					return false;
				}
			} else {
				return true;
			}
		},

		_handleODataSuccessMessage: function (oInfo) {
			var aInfoMessages = [{
				type: "Success",
				title: oInfo.message,
				description: "",
				counter: 0
			}];
			this._addMessage(aInfoMessages);
		},

		/**
		 * Handle Odata error
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
				}
				for (var i = 0; i < aMsgs.length; i++) {
					var oErrorMessage = {
						type: "Error",
						title: aMsgs[i].message,
						description: "",
						counter: 0
					};
					if (aMsgs[i].message === "An exception was raised") {
						continue;
					}
					switch (aMsgs[i].severity) {
					case "error":
						oErrorMessage.type = MessageType.Error;
						break;
					case "warning":
						oErrorMessage.type = MessageType.Warning;
						break;
					case "info":
						oErrorMessage.type = MessageType.Success;
						break;
					case "success":
						oErrorMessage.type = MessageType.Success;
						break;
					default:
						oErrorMessage.type = MessageType.Warning;
						break;
					}
					aErrorMessage.push(oErrorMessage);
				}
				this._addMessage(aErrorMessage);
				if (!bContinue) {
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
				}
			} catch (exc) {
				jQuery.sap.log.info("Error while handling message return");
			}
		},

		/**
		 * Logic of method is unclear yet
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
		},

		/**
		 * Event clicking on the message popover button
		 * @public
		 */
		handleMessagePopoverPress: function (oEvent) {
			var oMessagePopover = this._getMessagePopover();
			oEvent.getSource().addDependent(oMessagePopover);
			oMessagePopover.toggle(oEvent.getSource());
		},

		/**
		 * Get current instance of MessagePopover from a view
		 * @public
		 */
		_getMessagePopover: function () {
			if (!this._messagePopover) {
				var oMessageTemplate = new MessagePopoverItem({
					type: "{messageModel>type}",
					title: "{messageModel>title}",
					description: "{messageModel>description}",
					subtitle: "{messageModel>subtitle}",
					counter: "{messageModel>counter}"
				});
				this._messagePopover = new MessagePopover({
					items: {
						path: "messageModel>/aMessages",
						template: oMessageTemplate
					},
					headerButton: new sap.m.Button({
						text: "Clear Messages",
						press: jQuery.proxy(this._clearMessages, this).bind(this)
					})
				});
			}
			return this._messagePopover;
		}

	});

});