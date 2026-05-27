/*global location history */
sap.ui.define([
	"com/erpis/shiperp/eod/controller/BaseController",
	"com/erpis/shiperp/eod/common/Utils",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/eod/model/formatter",
	"sap/ui/model/Sorter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, Utils, JSONModel, formatter, Sorter, Filter, FilterOperator, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.eod.controller.Main", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Register event load 
			this.oCarrierDeferred = $.Deferred();
			this.oShippingDeferred = $.Deferred();

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);

			this.oBundle = this.getResourceBundle();

			var oLocalModel = new JSONModel({
				oNewCloseItem: {},
				aCloseListItems: []
			});
			this.setModel(oLocalModel, "local");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.byId("idCarrierSelect").getBinding("items").attachDataReceived(this.onCarrierSelectLoad, this);
			this.byId("idShippingPointSelect").getBinding("items").attachDataReceived(this.onShippingPointSelectLoad, this);

			$.when(this.oCarrierDeferred, this.oShippingDeferred).done(function () {
				this._closeLogFilter();
				this.hideBusy();
			}.bind(this));
		},

		onCarrierSelectLoad: function () {
			this.oCarrierDeferred.resolve();
		},

		onShippingPointSelectLoad: function () {
			this.oShippingDeferred.resolve();
		},

		onExecute: function (oEvent) {
			this._execute();
		},

		onAccountValueHelp: function (oEvent) {
			var oCarrierDlg = Utils.getFragment("", "AccountDialog", this);
			oCarrierDlg.open();
		},

		onCarrierChange: function (oEvent) {
			var sKey = oEvent.getSource().getSelectedKey();
			this._updateServiceSelect(sKey);
			this._updatePoESelect(sKey);
			this._closeLogFilter();
		},

		onShippingPointChange: function () {
			this._closeLogFilter();
		},

		onAccountNoChange: function () {
			this._closeLogFilter();
		},

		onCloseTradeDirectDialog: function (oEvent) {
			this.oCarrierTracking.close();
		},

		onConfirmTradeDirectDialog: function (oEvent) {
			var oTab = this.byId(this.getView().createId("idTradeDirectTabDlg"));
			var aSelectedIndices = oTab.getSelectedIndices();

			if (aSelectedIndices.length === 0) {
				return;
			}

			var oRequestData = this._generateTradeDirectSetUsecase(oTab, aSelectedIndices);
			this._confirm(oRequestData);
		},

		onCloseCloseDialog: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onConfirmCloseDialog: function (oEvent) {
			var oTab = this.byId(this.getView().createId("idCloseTabDlg"));
			var aSelectedIndices = oTab.getSelectedIndices();

			if (aSelectedIndices.length === 0) {
				return;
			}

			var oRequestData = this._generateCloseSetUsecase(oTab, aSelectedIndices);
			this._confirm(oRequestData);
		},

		onCancelClose: function (oEvent) {
			if (this.byId("iCloseTab").getSelectedItems().length === 0) {
				MessageBox.error(this.oBundle.getText("SelectCloseIDToCancel"));
				return;
			}
			this._cancel();
		},

		onSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();
			var aList = oTab.getSelectedItems();
			var bFlag = false;
			var oItem;
			for (var i = 0; i < aList.length; i++) {
				oItem = aList[i];
				if (oItem.getBindingContext().getObject().Cancelled !== "") {
					if (oEvent.getParameter("selected")) {
						bFlag = true;
						break;
					}
				}
			}
			if (bFlag) {
				// Unselect Items with Cancel status available
				for (i = 0; i < aList.length; i++) {
					oItem = aList[i];
					if (oItem.getBindingContext().getObject().Cancelled !== "") {
						if (oEvent.getParameter("selected")) {
							oItem.setSelected(false);
						}
					}
				}
				MessageBox.warning(this.oBundle.getText("SelectCloseIDActionNotAllowed"));
			}
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

		onResendPld: function (oEvent) {
			var oTab = this.byId("iCloseTab");
			var aItems = oTab.getSelectedItems();
			if (aItems.length !== 1) {
				MessageBox.warning(this.oBundle.getText("invalidSelection"));
				return;
			}
			this._resendPld(aItems[0].getBindingContext().getObject());
		},

		onResendClose: function (oEvent) {
			var oTab = this.byId("iCloseTab");
			var aItems = oTab.getSelectedItems();
			if (aItems.length !== 1) {
				MessageBox.warning(this.oBundle.getText("invalidSelection"));
				return;
			}
			this._resendClose(aItems[0].getBindingContext().getObject());
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		_resendPld: function (oData) {
			this.showBusy();
			this.getModel().callFunction("/ResendPLD", {
				"method": "GET",
				urlParameters: {
					Station: this.sStation,
					Profile: this.sProfile,
					CloseId: oData.CloseID
				},
				success: function () {
					MessageToast.show(this.oBundle.getText("resendPldSuccessfully"));
					this.byId("iCloseTab").getBinding("items").refresh();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_resendClose: function (oData) {
			this.showBusy();
			this.getModel().callFunction("/ResendClose", {
				"method": "GET",
				urlParameters: {
					CarrierCode: oData.CarrierCode,
					Station: this.sStation,
					Profile: this.sProfile,
					CloseId: oData.CloseID
				},
				success: function () {
					MessageToast.show(this.oBundle.getText("resendCloseSuccessfully"));
					this.byId("iCloseTab").getBinding("items").refresh();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_cancel: function () {
			this.showBusy();
			var oItem;
			var aItems = this.byId("iCloseTab").getSelectedItems();
			for (var i = 0; i < aItems.length; i++) {
				oItem = aItems[i].getBindingContext().getObject();
				this.getModel().callFunction("/CancelClose", {
					method: "GET",
					urlParameters: {
						CloseId: oItem.CloseID
					},
					groupId: "MassCancel",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "MassCancel",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("cancelSuccess"));
					}
					// REFRESH Table Control
					var oTab = this.byId("iCloseTab");
					oTab.removeSelections();
					oTab.getBinding("items").refresh();
					this.hideBusy();
				}.bind(this),
				error: function (oErr) {
					this.hideBusy();
				}.bind(this)
			});
		},

		_closeLogFilter: function () {
			var oTab = this.byId("iCloseTab");
			var oPanelData = this._getControlPanelData();
			var oAllFilter = [
				new Filter("CarrierCode", sap.ui.model.FilterOperator.Contains, oPanelData.CarrierCode),
				new Filter("ShippingPoint", sap.ui.model.FilterOperator.Contains, oPanelData.ShippingPoint)
			];

			if (oPanelData.AccountNoFrom && oPanelData.AccountNoTo) {
				oAllFilter.push(new Filter("AccountNumber", sap.ui.model.FilterOperator.BT, oPanelData.AccountNoFrom, oPanelData.AccountNoTo));
			} else if (oPanelData.AccountNoFrom || oPanelData.AccountNoTo) {
				oAllFilter.push(new Filter("AccountNumber", sap.ui.model.FilterOperator.EQ, oPanelData.AccountNoFrom || oPanelData.AccountNoTo));
			}
			oTab.bindItems({
				path: "/xSERPERPxI_CLOG",
				filters: [new Filter(oAllFilter, true)],
				sorter: new Sorter("Cancelled", false),
				template: Utils.getFragment("", "CloseLogListItemTemplate", this)
			});
		},

		_generateCloseSetUsecase: function (oTab, aSelectedIndices) {
			var aItemsData = [];
			for (var i = 0; i < aSelectedIndices.length; i++) {
				var oItem = oTab.getBinding("rows").getContexts()[aSelectedIndices[i]].getObject();
				aItemsData.push(oItem);
			}
			var oData = this._getControlPanelData();
			oData.CloseSet = aItemsData;
			oData.Action = "Close";
			return oData;
		},

		_generateTradeDirectSetUsecase: function (oTab, aSelectedIndices) {
			var aItemsData = [];
			for (var i = 0; i < aSelectedIndices.length; i++) {
				var oItem = oTab.getBinding("rows").getContexts()[aSelectedIndices[i]].getObject();
				aItemsData.push(oItem);
			}
			var oData = this._getControlPanelData();
			oData.TradeDirectSet = aItemsData;
			oData.Action = "Close";
			return oData;
		},

		_confirm: function (oRequestData) {
			this.showBusy();
			this.getModel().create("/ControlPanelSet", oRequestData, {
				success: function (oData, oResponse) {
					this.hideBusy();
					this.oCarrierTracking.close();
					MessageToast.show(this.oBundle.getText("closesuccessMsg"));
					this.byId("iCloseTab").getBinding("items").refresh(true);
					this._handleOdataResponse(oResponse);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_updateServiceSelect: function (sCarrier) {
			var oServiceControl = this.byId("idServiceSelect");
			oServiceControl.bindItems({
				path: "/xSERPERPxI_CCLOSE",
				template: new sap.ui.core.Item({
					text: "{Description}",
					key: "{Service}"
				}),
				filters: [new Filter("CarrierCode", "EQ", sCarrier)]
			});
		},

		_updatePoESelect: function (sCarrier) {
			var oServiceControl = this.byId("idBreakbulkPortSelect");
			oServiceControl.bindItems({
				path: "/xSERPERPxI_CBBPORT",
				template: new sap.ui.core.Item({
					text: "{BreakbulkPortDesc}",
					key: "{BreakbulkPort}"
				}),
				filters: [new Filter("Carrier", "EQ", sCarrier)]
			});
		},

		_execute: function () {
			var oRequestData = this._generateExecuteUsecase();
			this.showBusy();
			this.getModel().create("/ControlPanelSet", oRequestData, {
				success: function (oData) {
					var sFragmentName = "";
					var aResults = [];
					if (oRequestData.TrdeDrc === "X") {
						if (oData.TradeDirectSet) {
							aResults = oData.TradeDirectSet.results;
						}
						this.getModel("local").setProperty("/TradeDirectSet", aResults);
						sFragmentName = "TradeDirectDialog";
					} else {
						if (oData.CloseSet) {
							aResults = oData.CloseSet.results;
						}
						this.getModel("local").setProperty("/CloseSet", aResults);
						sFragmentName = "CloseDialog";
					}
					this.oCarrierTracking = Utils.getFragment("", sFragmentName, this);
					this.oCarrierTracking.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateExecuteUsecase: function () {
			var oData = this._getControlPanelData();
			oData.Action = "GetClose";
			return oData;
		},

		_getControlPanelData: function () {
			var sCarrier = this.byId("idCarrierSelect").getSelectedKey() || this.byId("idCarrierSelect").getItems()[0].getKey();
			var sTradeDirect = this.byId("idTradeDirectChck").getSelected() === true ? "X" : "";
			var sService = this.byId("idServiceSelect").getSelectedKey();
			var sShippingPoint = this.byId("idShippingPointSelect").getSelectedKey() || this.byId("idShippingPointSelect").getItems()[0].getKey();
			var sCloseDate = this.byId("idCloseDatePicker").getValue();
			var sAccountnoFrom = this.byId("idAccountnoInputFrom").getValue();
			var sAccountnoTo = this.byId("idAccountnoInputTo").getValue();
			var sBreakbulkPort = this.byId("idBreakbulkPortSelect").getSelectedKey();
			var sReferenceShipPoint = this.byId("idReferenceShipPointRadio").getSelected() === true ? "X" : "";
			var sSelectedShipPoint = this.byId("idShipPointRadio").getSelected() === true ? "X" : "";

			var oData = {
				Id: "",
				Action: "",
				CarrierCode: sCarrier,
				ShippingPoint: sShippingPoint,
				AccountNoFrom: sAccountnoFrom,
				AccountNoTo: sAccountnoTo,
				PortOfExport: sBreakbulkPort,
				ServiceID: sService,
				ShipDate: "",
				CloseDate: sCloseDate,
				Bbid: "",
				RefPnt: sReferenceShipPoint,
				ShipPnt: sSelectedShipPoint,
				TrdeDrc: sTradeDirect,
				CloseSet: [],
				TradeDirectSet: []
			};

			return oData;
		}

	});
});