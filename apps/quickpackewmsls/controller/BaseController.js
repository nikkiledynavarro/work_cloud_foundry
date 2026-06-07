sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/ui/core/library",
	"sap/m/MessageBox",
	"sap/ui/core/BusyIndicator",
	"com/erpis/shiperp/hr7/quickpackewm/common/Utils",
	"sap/m/MessageToast",
], function (Controller, JSONModel, History, Filter, MessagePopover, MessagePopoverItem, library, MessageBox,
	BusyIndicator, Utils, MessageToast) {
	"use strict";
	var MessageType = library.MessageType;

	return Controller.extend("com.erpis.shiperp.quickpackewm.controller.BaseController", {

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

		/********** MESSAGE POPOVER HANDLER *************/
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
				title: oPassMessage.Message,
				description: oPassMessage.description || "",
				counter: 0
			};

			if (oPassMessage.Message === "An exception was raised" ||
				oPassMessage.Message === "Service provider did not return any business data" ||
				oPassMessage.Message === "") {
				return null;
			}
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = MessageType.Error;
				break;
			case "W":
				oMessage.type = MessageType.Warning;
				break;
			case "I":
				oMessage.type = MessageType.Information;
				break;
			case "S":
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
			var bErrorFound = false;
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

				// Check if at least there is one error message
				for (var i = 0; i < aErrorMessage.length; i++) {
					if (aErrorMessage[i].type === "Error") {
						bErrorFound = true;
						break;
					}
				}

				if (aErrorMessage.length > 0) {
					this._addMessage(aErrorMessage);
					if (!bContinue) {
						// Sometime we don't have a Message Icon button on the bottom left corner -> show on MessageBox
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
				}
			} catch (exc) {
				jQuery.sap.log.info("Error while handling message return");
			}
			return bErrorFound;
		},

		/**
		 * Add message
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
			this.getModel("messageModel").setProperty("/messagesLength", 0);
			this.getModel("messageModel").setProperty("/aMessages", []);
			this._messagePopover.close();
		},

		/**
		 * Before Close Popover message
		 * @public
		 */
		onBeforeMessagePopoverClose: function (oEvent) {
			// sap.ui.getCore().byId("btnMessagePopoverBack").setVisible(false);
			this.byId("btnMessagePopoverBack").setVisible(false);
			this._messagePopover.getContent()[0].navigateBack();
		},

		/**
		 * Close Popover message
		 * @public
		 */
		onClosePopover: function (oEvent) {
			this._messagePopover.close();
		},

		/**
		 * Select a Message Item
		 * @public
		 */
		onMessageViewBack: function (oEvent) {
			this._messagePopover.getContent()[0].navigateBack();
			oEvent.getSource().setVisible(false);
		},

		onSelectMessageItem: function (oEvent) {
			this.byId("btnMessagePopoverBack").setVisible(true);
			// sap.ui.getCore().byId("btnMessagePopoverBack").setVisible(true);
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
				this._messagePopover = Utils.getFragment(null, "MessagePopover", this);
			}
			return this._messagePopover;
		},

		treeify: function (list, idAttr, parentAttr, childrenAttr) {
			if (!idAttr) idAttr = 'handlingUnit';
			if (!parentAttr) parentAttr = 'parentHU';
			if (!childrenAttr) childrenAttr = 'Children';

			var treeList = [];
			var lookup = {};
			list.forEach(function (obj) {
				lookup[obj[idAttr]] = obj;
				obj[childrenAttr] = [];
			});
			list.forEach(function (obj) {
				if (typeof obj[parentAttr] === 'string') {
					if (obj[parentAttr].trim() === "") {
						treeList.push(obj);
					}
				}
				if (obj[parentAttr] === 0) {
					treeList.push(obj);
				} else {
					if (lookup[obj[parentAttr]] && lookup[obj[parentAttr]][childrenAttr]) {
						lookup[obj[parentAttr]][childrenAttr].push(obj);
					}
				}
			});
			return treeList;
		},
	});
});