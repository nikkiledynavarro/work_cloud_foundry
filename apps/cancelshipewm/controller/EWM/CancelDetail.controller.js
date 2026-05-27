sap.ui.define([
	"com/erpis/shiperp/cancelshipewm/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/cancelshipewm/hr7/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.cancelshipewm.hr7.controller.EWM.CancelDetail", {
		/* =========================================================== */
		/* Global variables for this view                              */
		/* =========================================================== */

		//Link to "com.erpis.shiperp.cancelshipewm.hr7.model.formatter" for formatter functions
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
			this.byId("idIDInp").setValue("");
			this.byId("idIDInp").setEditable(true);
			/* Set Message empty*/
			this.getModel("messageModel").setData({
				aMessages: [],
				messagesLength: 0
			});
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
			var aItems = [];
			/* Set Message empty*/
			this.getModel("messageModel").setData({
				aMessages: [],
				messagesLength: 0
			});
			if (this.getModel("local").getProperty("/Mps")) { // MPS on
				aItems = oTab.getItems();
				this.bAllItemSelected = true;
				if (aItems.length !== this.getModel("local").getProperty("/freightUnitList").length || aItems.length === 0) {
					MessageBox.error(this.oBundle.getText("partialCancelNotAllowed"));
					return;
				}
			} else { // MPS off
				this.bAllItemSelected = false;
				aItems = oTab.getSelectedItems();
				if (aItems.length === 0) {
					MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
					return;
				}
			}

			var oDocTypeSelect = this.byId("idDocTypeSelect");
			var sDocType = oDocTypeSelect.getSelectedKey().replace(/^0+/, ''); //Now selected doctype will have format "0001", "0002"...
			var sInputtedId = this.byId("idIDInp").getValue();
			var aSelectedCancel = [];
			var aData = this.getModel("local").getProperty("/freightUnitList");
			aData.forEach(function (obj) {
				var bMatched = false;
				aItems.forEach(function (item) {
					var oSelected = item.getBindingContext("local").getObject();
					if (oSelected.Trackingnum === obj.Trackingnum) {
						bMatched = true;
					}
				});
				obj.Sel = bMatched ? 'X' : '';
				aSelectedCancel.push(obj);
			});
			this._getCancelShipment(aSelectedCancel, sDocType, sInputtedId);
		},

		onCancelDetailUpdateFinished: function () {
			this.hideBusy();
		},

		onFilterChange: function () {
			this.showBusy();
			var oDocTypeSelect = this.byId("idDocTypeSelect");
			this.byId("idIDInp").setEditable(false);
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
					this.getModel("local").setProperty("/Mps", oData.mpstype);
					if (oData.return.results.length > 0) {
						MessageToast.show(oData.return.results[0].Message);
						var aMsg = this._generateMessages(oData.return.results);
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

		_generateMPSCheckUsecase: function (aHUList, sId, sDocType) {
			var aListHU = this._handleHUSPayload(aHUList);
			var oData = {
				shipmentid: "",
				inputids: (sId) ? sId : "",
				inputtype: (sDocType) ? sDocType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sShipStation) ? this.sShipStation : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
			    transaction_class: "C",
				action: "MPSCheck",
				mpstype: "",
				HUS: aListHU,
				return: []
			};

			return oData;
		},

		_handleHUSPayload: function (aHUS) {
			var aHandlingUnit = [];
			if (aHUS && aHUS.length > 0) {
				for (var i = 0; i < aHUS.length; i++) {
					var oHandlingUnit = {};
					oHandlingUnit.Pmat = aHUS[i].Pmat;
					oHandlingUnit.Laeng = aHUS[i].Laeng;
					oHandlingUnit.Breit = aHUS[i].Breit;
					oHandlingUnit.Hoehe = aHUS[i].Hoehe;
					oHandlingUnit.Meabm = aHUS[i].Meabm;
					oHandlingUnit.Weight = aHUS[i].Weight;
					oHandlingUnit.Weightunit = aHUS[i].Weightunit;
					oHandlingUnit.Sel = aHUS[i].Sel;
					oHandlingUnit.Trackingnumber = aHUS[i].Trackingnum;
					oHandlingUnit.Docno = aHUS[i].Docno;
					oHandlingUnit.Doccat = aHUS[i].Doccat;
					aHandlingUnit.push(oHandlingUnit);
				}
			}
			return aHandlingUnit;
		},

		_getCancelShipment: function (aSelectedCancel, sDocType, sID) {
			this.showBusy();
			var oRequestData = this._generateCancelShipmentUsecase(aSelectedCancel, sDocType, sID);
			this.getModel("cancelEWMService").create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					this.hideBusy();
					this.getModel("local").setProperty("/freightUnitList", oData.ShipDataSet.results);
					var bHasErrorMessCheck = false;
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (oData.return.results.length > 0) {
						MessageToast.show(oData.return.results[0].Message);
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						for (var i = 0; i < aMsg.length; i++) {
							if (aMsg[i].type == "Error") {
								bHasErrorMessCheck = true;
							}
						}
						if (this._getMessagePopover().isOpen()) {
							// Continue process
						} else {
							if (aMsg.length > 0) this.byId('popoverButton').firePress();
						}
					}
					if (!bHasErrorMessCheck) {
						if (this.bAllItemSelected) {
							this.byId("idTrackproTabEWM").removeAllItems();
							this.byId("idIDInp").setValue("");
							this.byId("idIDInp").setEditable(true);
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

		_generateCancelShipmentUsecase: function (aSelectedCancel, sDocType, sID) {
			var oData = {
				shipmentid: "",
				inputids: (sID) ? sID : "",
				inputtype: (sDocType) ? sDocType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sShipStation) ? this.sShipStation : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "CancelShipment",
				transaction_class: "C",
				ShipDataSet: aSelectedCancel,
				return: []
			};
			return oData;
		},

		onRefresh: function () {
			this.byId("idIDInp").setValue("");
			this.byId("idIDInp").setEditable(true);
			this.getModel("local").setData({});
			/* Set Message empty*/
			this.getModel("messageModel").setData({
				aMessages: [],
				messagesLength: 0
			});
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

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/* Start Backup code*/
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
		/* End Backup code*/

		_getShipDataCancel: function (sDocType, sID) {
			this.getModel("cancelEWMService").read("/ShipmentCancelReturnSet", {
				filters: [
					new Filter("inputIds", "EQ", sID),
					new Filter("inputType", "EQ", sDocType)
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
					this.getModel("local").setData({});
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		}
	});
});