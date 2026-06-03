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
	"sap/ui/core/BusyIndicator",
	"com/erpis/shiperp/salesorder/hr7/common/Utils"
], function (Controller, JSONModel, History, Filter, FilterOperator, MessagePopover, MessagePopoverItem, Link, MessageType, MessageBox,
	BusyIndicator, Utils) {
	"use strict";

	return Controller.extend("com.erpis.shiperp.saleorder.controller.BaseController", {

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
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				this.getRouter().navTo("master", {}, true);
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
			var oMessage = JSON.parse(oResponse.headers["sap-message"]);
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
					for (i = 0; i < this.getModel("messageModel").getProperty("/aMessages").length; i++) {
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
				// this._messagePopover = sap.ui.xmlfragment("com.erpis.shiperp.saleorder.fragment.MessagePopover", this);
				this._messagePopover = Utils.getFragment(null, "MessagePopover", this);
			}
			return this._messagePopover;
		},

		treeify: function (list, idAttr, parentAttr, childrenAttr) {
			if (!idAttr) idAttr = "NodeId";
			if (!parentAttr) parentAttr = "HeirLvl";
			if (!childrenAttr) childrenAttr = "Children";
			var treeList = [];
			var lookup = {};
			list.forEach(function (obj) {
				lookup[obj[idAttr]] = obj;
				obj[childrenAttr] = [];
			});
			list.forEach(function (obj) {
				if (obj[parentAttr] !== 0) {
					lookup[obj[parentAttr]][childrenAttr].push(obj);
				} else {
					treeList.push(obj);
				}
			});
			return treeList;
		},

		// This method will reupdate the original Proposal Active flag onto the newly return oData
		_updateOriginalPackingProposalActive: function (oData) {
			var aOriginalShipset = this.getModel("global").getProperty("/ShipSetSetOriginal") || [];
			for (var i = 0; i < oData.ShipSetSet.results.length; i++) {
				var sVbeln = oData.ShipSetSet.results[i].Vbeln;
				var sVstel = oData.ShipSetSet.results[i].Vstel;
				var sInco1 = oData.ShipSetSet.results[i].Inco1;
				var sKunwe = oData.ShipSetSet.results[i].Kunwe;
				var sDelivery = oData.ShipSetSet.results[i].Delivery;
				var sCounter = oData.ShipSetSet.results[i].Counter;
				for (var j = 0; j < aOriginalShipset.length; j++) {
					if (sVbeln === aOriginalShipset[j].Vbeln &&
						sVstel === aOriginalShipset[j].Vstel &&
						sInco1 === aOriginalShipset[j].Inco1 &&
						sKunwe === aOriginalShipset[j].Kunwe &&
						sDelivery === aOriginalShipset[j].Delivery &&
						sCounter === aOriginalShipset[j].Counter) {
						oData.ShipSetSet.results[i].PropActive = aOriginalShipset[j].PropActive;
						break;
					}
				}
			}
		},

		_addCommonSOFlatStructureToPayload: function (oData) {
			var oGlobalModel = this.getModel("global");
			// To store the new common flat sales order structure
			var oVbak = oGlobalModel.getProperty("/Vbak") || {};
			var aVbapvbSet = oGlobalModel.getProperty("/VbapvbSet") || [];
			var aVbepvbSet = oGlobalModel.getProperty("/VbepvbSet") || [];
			var aVbfavbSet = oGlobalModel.getProperty("/VbfavbSet") || [];
			var aVbkdvbSet = oGlobalModel.getProperty("/VbkdvbSet") || [];
			var aVbpavbSet = oGlobalModel.getProperty("/VbpavbSet") || [];
			var aVbupvbSet = oGlobalModel.getProperty("/VbupvbSet") || [];
			var aSadrvbSet = oGlobalModel.getProperty("/SadrvbSet") || [];
			var oVbkd = oGlobalModel.getProperty("/Vbkd") || {};

			var aShipSetCommonSet = oGlobalModel.getProperty("/ShipSetCommonSet") || [];
			var aTrackproShipSetKeyCommonSet = oGlobalModel.getProperty("/TrackproShipSetKeyCommonSet") || [];
			var aMoreoptCommonSet = oGlobalModel.getProperty("/MoreoptCommonSet") || [];
			var aTrackproVerkoCommonSet = oGlobalModel.getProperty("/TrackproVerkoCommonSet") || [];
			var aTrackproVerpoCommonSet = oGlobalModel.getProperty("/TrackproVerpoCommonSet") || [];
			var aTrackproPackHUdataCommonSet = oGlobalModel.getProperty("/TrackproPackHUdataCommonSet") || [];
			var aTrackproPackItmdataCommonSet = oGlobalModel.getProperty("/TrackproPackItmdataCommonSet") || [];

			if (aMoreoptCommonSet.length === 0) {
				aMoreoptCommonSet = [{
					ValueListMoreoptCommonSet: []
				}];
			} else {
				for (var i = 0; i < aMoreoptCommonSet.length; i++) {
					if (!aMoreoptCommonSet[i].ValueListMoreoptCommonSet) {
						aMoreoptCommonSet[i].ValueListMoreoptCommonSet = [];
					}
				}
			}

			oData.Vbak = oVbak;
			oData.VbapvbSet = aVbapvbSet;
			oData.VbepvbSet = aVbepvbSet;
			oData.VbfavbSet = aVbfavbSet;
			oData.VbkdvbSet = aVbkdvbSet;
			oData.VbpavbSet = aVbpavbSet;
			oData.VbupvbSet = aVbupvbSet;
			oData.SadrvbSet = aSadrvbSet;
			oData.Vbkd = oVbkd;

			oData.ShipSetCommonSet = aShipSetCommonSet;
			oData.TrackproShipSetKeyCommonSet = aTrackproShipSetKeyCommonSet;

			oData.MoreoptCommonSet = aMoreoptCommonSet;
			oData.TrackproVerkoCommonSet = aTrackproVerkoCommonSet;
			oData.TrackproVerpoCommonSet = aTrackproVerpoCommonSet;
			oData.TrackproPackHUdataCommonSet = aTrackproPackHUdataCommonSet;
			oData.TrackproPackItmdataCommonSet = aTrackproPackItmdataCommonSet;

		},

		_overwriteCommonSOFlatStructure: function (oData) {
			var oGlobalModel = this.getModel("global");
			if (oData.Vbak) {
				oGlobalModel.setProperty("/Vbak", oData.Vbak);
			} else {
				oGlobalModel.setProperty("/Vbak", {});
			}
			if (oData.VbapvbSet) {
				oGlobalModel.setProperty("/VbapvbSet", oData.VbapvbSet.results);
			} else {
				oGlobalModel.setProperty("/VbapvbSet", []);
			}
			if (oData.VbepvbSet) {
				oGlobalModel.setProperty("/VbepvbSet", oData.VbepvbSet.results);
			} else {
				oGlobalModel.setProperty("/VbepvbSet", []);
			}
			if (oData.VbfavbSet) {
				oGlobalModel.setProperty("/VbfavbSet", oData.VbfavbSet.results);
			} else {
				oGlobalModel.setProperty("/VbfavbSet", []);
			}
			if (oData.VbkdvbSet) {
				oGlobalModel.setProperty("/VbkdvbSet", oData.VbkdvbSet.results);
			} else {
				oGlobalModel.setProperty("/VbkdvbSet", []);
			}
			if (oData.VbpavbSet) {
				oGlobalModel.setProperty("/VbpavbSet", oData.VbpavbSet.results);
			} else {
				oGlobalModel.setProperty("/VbpavbSet", []);
			}
			if (oData.VbupvbSet) {
				oGlobalModel.setProperty("/VbupvbSet", oData.VbupvbSet.results);
			} else {
				oGlobalModel.setProperty("/VbupvbSet", []);
			}
			if (oData.SadrvbSet) {
				oGlobalModel.setProperty("/SadrvbSet", oData.SadrvbSet.results);
			} else {
				oGlobalModel.setProperty("/SadrvbSet", []);
			}
			if (oData.Vbkd) {
				oGlobalModel.setProperty("/Vbkd", oData.Vbkd);
			} else {
				oGlobalModel.setProperty("/Vbkd", {});
			}
			if (oData.ShipSetCommonSet) {
				oGlobalModel.setProperty("/ShipSetCommonSet", oData.ShipSetCommonSet.results);
			} else {
				oGlobalModel.setProperty("/ShipSetCommonSet", []);
			}
			if (oData.TrackproShipSetKeyCommonSet) {
				oGlobalModel.setProperty("/TrackproShipSetKeyCommonSet", oData.TrackproShipSetKeyCommonSet.results);
			} else {
				oGlobalModel.setProperty("/TrackproShipSetKeyCommonSet", []);
			}
			if (oData.MoreoptCommonSet) {
				oGlobalModel.setProperty("/MoreoptCommonSet", oData.MoreoptCommonSet.results);
			} else {
				oGlobalModel.setProperty("/MoreoptCommonSet", []);
			}
			// if (oData.SadrvbSet) {
			// 	this.getModel("global").setProperty("/ValueListMoreoptCommonSet", oData.ValueListMoreoptCommonSet.results);
			// } else {
			// 	this.getModel("global").setProperty("/ValueListMoreoptCommonSet", []);
			// }
			if (oData.TrackproVerkoCommonSet) {
				oGlobalModel.setProperty("/TrackproVerkoCommonSet", oData.TrackproVerkoCommonSet.results);
			} else {
				oGlobalModel.setProperty("/TrackproVerkoCommonSet", []);
			}
			if (oData.TrackproVerpoCommonSet) {
				oGlobalModel.setProperty("/TrackproVerpoCommonSet", oData.TrackproVerpoCommonSet.results);
			} else {
				oGlobalModel.setProperty("/TrackproVerpoCommonSet", []);
			}
			if (oData.TrackproPackHUdataCommonSet) {
				oGlobalModel.setProperty("/TrackproPackHUdataCommonSet", oData.TrackproPackHUdataCommonSet.results);
			} else {
				oGlobalModel.setProperty("/TrackproPackHUdataCommonSet", []);
			}
			if (oData.TrackproPackItmdataCommonSet) {
				oGlobalModel.setProperty("/TrackproPackItmdataCommonSet", oData.TrackproPackItmdataCommonSet.results);
			} else {
				oGlobalModel.setProperty("/TrackproPackItmdataCommonSet", []);
			}
		}
	});
});