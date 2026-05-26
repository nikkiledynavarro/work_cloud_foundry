sap.ui.define([
	"com/erpis/shiperp/sls/cancelshipment/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/sls/cancelshipment/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.cancelshipment.controller.EWM.CancelDetail", {
		/* =========================================================== */
		/* Global variables for this view                              */
		/* =========================================================== */

		//Link to "com.erpis.shiperp.sls.cancelshipment.model.formatter" for formatter functions
		formatter: formatter,
		oBundle: null,
		sShipStation: "",
		sProfile: "",
		bAllItemSelected: false,

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.oInputTypeDeferred = $.Deferred();

			//1.Create local model for the view
			var oLocalModel = new JSONModel({
				aSelectedShippingPoints: []
			});
			this.setModel(oLocalModel, "local");

			//2. When ever user go to the route "cancelDetail", trigger this._onObjectMatched()
			this.getRouter().getRoute("cancelDetailEWM").attachPatternMatched(this._onObjectMatched, this);

			//3. Create message model
			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			//4. Assign resource bundle
			this.oBundle = this.getResourceBundle();
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.sShipStation = oEvent.getParameter("arguments").ShipStation;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.sWarehouseNumber = oEvent.getParameter("arguments").WarehouseNumber;
			var oDocTypeSelect = this.byId("idDocTypeSelect");
			oDocTypeSelect.getBinding("items").attachDataReceived(this.onInputTypeLoaded, this);

			$.when(this.oInputTypeDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		},

		/* =========================================================== */
		/* Events handler                                              */
		/* =========================================================== */
		onCancel: function () {
			var oTab = this.byId("idTrackproTabEWM");

			var aItems = oTab.getSelectedItems(); //Currently backend is not done, so the whole list is required to be transferred to backend

			var iNumberOfItemsOnTable = oTab.getItems().length;

			//If All items on the table is selected, set the flag "bAllItemSelected" to true
			if (iNumberOfItemsOnTable === aItems.length) {
				this.bAllItemSelected = true;
			} else {
				this.bAllItemSelected = false;
			}

			if (this.getModel("local").getProperty("/Mps")) { // MPS on
				if (aItems.length !== this.getModel("local").getProperty("/freightUnitList").length || aItems.length === 0) {
					MessageBox.error(this.oBundle.getText("partialCancelNotAllowed"));
					return;
				}
			} else { // MPS off
				if (aItems.length === 0) {
					MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
					return;
				}
			}

			var oDocTypeSelect = this.byId("idDocTypeSelect");
			var sDocType = oDocTypeSelect.getSelectedKey(); //Now selected doctype will have format "0001", "0002"...
			//Remove leading "000" from selected Doctype
			sDocType = sDocType.replace(/^0+/, '');
			var sDocTypeDesc = oDocTypeSelect.getSelectedItem().getText();
			var sInputtedId = this.byId("idIDInp").getValue();
			var alistTrackNum = [];
			for (var i = 0; i < aItems.length; i++) {
				alistTrackNum.push({
					TrackingNumber: aItems[i].getBindingContext("local").getObject().Trackingnum
				});
			}
			this._getCancelShipment(alistTrackNum, sDocType, sInputtedId);
		},

		onCancelDetailUpdateFinished: function () {
			this.hideBusy();
		},

		onFilterChange: function () {
			this.showBusy();
			var oDocTypeSelect = this.byId("idDocTypeSelect");
			var oIDInput = this.byId("idIDInp");
			var sDocType = oDocTypeSelect.getSelectedKey(); //Now selected doctype will have format "0001", "0002"...

			//Remove leading "000" from selected Doctype
			sDocType = sDocType.replace(/^0+/, "");
			var sID = oIDInput.getValue();
			this._getShipDataCancel(sDocType, sID);
		},

		getMPSCheck: function (aHUList, sId, sDocType) {
			this.showBusy();
			var oRequestData = this._generateMPSCheckUsecase(aHUList, sId, sDocType);
			this.getModel("cancelEWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					if (oData.mpstype) {
						this.getModel("local").setProperty("/Mps", oData.mpstype);
						this._setSelectedAllItems();
					} else {
						this._setSelectedFirstItems();
					}
					if (oData.ReturnSet.results.length > 0) {
						MessageToast.show(oData.ReturnSet.results[0].Message);
						var aMsg = this._generateMessages(oData.ReturnSet.results);
						this._addMessage(aMsg);
					}
					this.hideBusy();
					//this._handleOdataResponse(oResponse);
				}.bind(this),
				error: function (oError) {
					this.oSelectedHu = null;
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_setSelectedAllItems: function () {
			var aItems = this.byId("idTrackproTabEWM").getItems();
			for (var i = 0; i < aItems.length; i++) {
				aItems[i].setSelected(true);
			}
		},
		_setSelectedFirstItems: function () {
			var aItems = this.byId("idTrackproTabEWM").getItems();
			if (aItems && aItems.length > 0) {
				aItems[0].setSelected(true);
			}
		},

		_generateMPSCheckUsecase: function (aHUList, sId, sDocType) {
			var aListHU = this._handleHUSPayload(aHUList);
			var oData = {
				shipmentid: "",
				inputids: (sId) ? sId : "",
				inputtype: (sDocType) ? sDocType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sShipStation) ? this.sShipStation : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "MPSCheck",
				mpstype: "",
				HUS: aListHU,
				ReturnSet: []
			};
			
			return oData;
		},

		_handleHUSPayload: function (aHUS) {
			var aHandlingUnit = [];
			if (aHUS && aHUS.length > 0) {
				for (var i = 0; i < aHUS.length; i++) {
					var oHandlingUnit = {};
					oHandlingUnit.Outbhu = aHUS[i].Outbhu;
					oHandlingUnit.Pmat = aHUS[i].Pmat;
					oHandlingUnit.LgplaPa = aHUS[i].LgplaPa;
					oHandlingUnit.Laeng = aHUS[i].Laeng;
					oHandlingUnit.Breit = aHUS[i].Breit;
					oHandlingUnit.Hoehe = aHUS[i].Hoehe;
					oHandlingUnit.Meabm = aHUS[i].Meabm;
					oHandlingUnit.Weight = aHUS[i].Weight;
					oHandlingUnit.Weightunit = aHUS[i].Weightunit;
					oHandlingUnit.Sel = aHUS[i].Sel;
					oHandlingUnit.Trackingnumber = aHUS[i].Trackingnumber;
					oHandlingUnit.Docno = aHUS[i].Docno;
					oHandlingUnit.Doccat = aHUS[i].Doccat;
					oHandlingUnit.Overpack = aHUS[i].Overpack;
					aHandlingUnit.push(oHandlingUnit);
				}
			}
			if (aHandlingUnit.length > 0) {
				var check = {};
				var res = [];
				for (var j = 0; j < aHandlingUnit.length; j++) {
					if (!check[aHandlingUnit[j]['Outbhu']]) {
						check[aHandlingUnit[j]['Outbhu']] = true;
						res.push(aHandlingUnit[j]);
					}
				}
				aHandlingUnit = res;
			}
			return aHandlingUnit;
		},

		_getCancelShipment: function (alistTrackNum, sDocType, sID) {
			this.showBusy();
			var oRequestData = this._generateCancelShipmentUsecase(alistTrackNum, sDocType, sID);
			this.getModel("cancelEWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					this.hideBusy();
					this.getModel("local").setProperty("/freightUnitList", []);
					var bHasErrorMessCheck = false;
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (oData.ReturnSet.results.length > 0) {
						MessageToast.show(oData.ReturnSet.results[0].Message);
						var aMsg = this._generateMessages(oData.ReturnSet.results);
						this._addMessage(aMsg);
						for (var i = 0; i < aMsg.length; i++) {
							if (aMsg[i].type == "Error") {
								bHasErrorMessCheck = true;
							}
						}
					}
					if (!bHasErrorMessCheck) {
						if (this.bAllItemSelected) {
							this.byId("idTrackproTabEWM").removeAllItems();
							this.byId("idIDInp").setValue("");
						} else {
							//else call backend to refresh data
							this.onFilterChange();
						}
					}
					//this._handleOdataResponse(oResponse);
				}.bind(this),
				error: function (oError) {
					this.oSelectedHu = null;
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCancelShipmentUsecase: function (alistTrackNum, sDocType, sID) {
			var oData = {
				shipmentid: "",
				inputids: (sID) ? sID : "",
				inputtype: (sDocType) ? sDocType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sShipStation) ? this.sShipStation : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "CancelShipment",
				TrackingSet: alistTrackNum,
				ReturnSet: []
			};
			return oData;
		},

		onRefresh: function () {
			this.byId("idIDInp").setValue("");
			this.getModel("local").setProperty("/freightUnitList", []);
		},

		onInputTypeLoaded: function () {
			this.oInputTypeDeferred.resolve();
		},

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}

			this._setCookie("AppTrack", "EWM");
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		},

		onTabUpdateFinishedEWM: function (oEvent) {
			var bMps = this.getModel("local").getProperty("/Mps");
			if (bMps === true) {
				oEvent.getSource().selectAll();
			} else {
				oEvent.getSource().removeSelections();
			}
		},
		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		// onPayloadCacel: function (aItems) {
		// 	var sBindingPath, oItem;
		// 	for (var i = 0; i < aItems.length; i++) {
		// 		sBindingPath = aItems[i].getBindingContextPath();
		// 		oItem = this.getModel("local").getProperty(sBindingPath);
		// 	}
		// },
		_cancel: function (sDocType, sDocTypeDesc, sID, aItems) {
			this.showBusy();
			var sBindingPath, oItem;
			for (var i = 0; i < aItems.length; i++) {
				sBindingPath = aItems[i].getBindingContextPath();
				oItem = this.getModel("local").getProperty(sBindingPath);
			}
			this.getModel("cancelEWMService").callFunction("/CancelShipment", {
				method: "POST",
				urlParameters: {
					Profile: this.sProfile,
					ShipStation: this.sShipStation,
					DocType: sDocType,
					DocTypeDesc: sDocTypeDesc,
					ID: sID,
					Trackingnum: oItem.Trackingnum
				},
				groupId: "ShippmentMassCancel",
				changeSetId: "cancel",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						MessageToast.show("Cancel successfully");
					}
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (this.bAllItemSelected) {
						this.byId("idTrackproTabEWM").removeAllItems();
						this.byId("idIDInp").setValue("");
					} else {
						//else call backend to refresh data
						this.onFilterChange();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (this.bAllItemSelected) {
						this.byId("idTrackproTabEWM").removeAllItems();
						this.byId("idIDInp").setValue("");
					} else {
						//else call backend to refresh data
						this.onFilterChange();
					}
					this._handleODataError(oError);
				}.bind(this)
			});
		},

		_getShipDataCancel: function (sDocType, sID) {
			this.getModel("cancelEWMService").read("/ShipmentCancelReturnSet", {
				filters: [
					new Filter("cancelInput", "EQ", sID),
					new Filter("cancelBy", "EQ", sDocType)
				],
				urlParameters: {
					"$expand": "ShipDataSet,ReturnSet"
				},
				success: function (oData) {
					this.byId("idTrackproTabEWM").removeSelections();
					this.getModel("local").setProperty("/freightUnitList", oData.results[0].ShipDataSet.results);
					if (oData.results[0].ShipDataSet.results.length > 0) {
						this.getMPSCheck(oData.results[0].ShipDataSet.results, sID, sDocType);
					} else {
						if (oData.results[0].ReturnSet.results.length > 0) {
							MessageBox.warning(oData.results[0].ReturnSet.results[0].Message);
							var aMsg = this._generateMessages(oData.results[0].ReturnSet.results);
							this._addMessage(aMsg);
						}
						this.hideBusy();
					}
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/freightUnitList", []);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		}
	});
});