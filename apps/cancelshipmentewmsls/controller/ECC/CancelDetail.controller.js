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

	return BaseController.extend("com.erpis.shiperp.cancelshipewm.hr7.controller.ECC.CancelDetail", {
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
			this.getRouter().getRoute("cancelDetailECC").attachPatternMatched(this._onObjectMatched, this);

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
			var oTab = this.byId("idTrackproTabECC");

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

			//The function import "CancelShipment" requires following params: 
			//1.Profile --> Get from Login view, currently saved in "this.sProfile" in "_onObjectMatched" method
			//2.ShipStation --> Get from Login view, currently saved in "this.sShipStation" in "_onObjectMatched" method
			//3.DocType  --> Get from the dropdown "idDocTypeSelect"
			//4.DocTypeDesc --> Get from the dropdown "idDocTypeSelect"
			//5.ID --> Get from the input "idIDInp"
			//6.TrackingNo --> Get from the array "aItems"

			var oDocTypeSelect = this.byId("idDocTypeSelect");
			var sDocType = oDocTypeSelect.getSelectedKey(); //Now selected doctype will have format "0001", "0002"...
			//Remove leading "000" from selected Doctype
			sDocType = sDocType.replace(/^0+/, '');
			var sDocTypeDesc = oDocTypeSelect.getSelectedItem().getText();
			var sInputtedId = this.byId("idIDInp").getValue();

			this._cancel(sDocType, sDocTypeDesc, sInputtedId, aItems, this.bAllItemSelected);
		},

		onCancelDetailUpdateFinished: function () {
			this.hideBusy();
		},

		onFilterChange: function () {
			this.showBusy();
			this.byId("idIDInp").setEditable(false);
			var oDocTypeSelect = this.byId("idDocTypeSelect");
			var oIDInput = this.byId("idIDInp");
			var sDocType = oDocTypeSelect.getSelectedKey(); //Now selected doctype will have format "0001", "0002"...

			//Remove leading "000" from selected Doctype
			sDocType = sDocType.replace(/^0+/, "");

			var sID = oIDInput.getValue();

			this._getFreghUnits(sDocType, sID);
		},

		onRefresh: function () {
			this.byId("idIDInp").setValue("");
			this.byId("idIDInp").setEditable(true);
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
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		onTabUpdateFinishedECC: function (oEvent) {
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
		_cancel: function (sDocType, sDocTypeDesc, sID, aItems) {
			this.showBusy();
			var sBindingPath, oItem;
			for (var i = 0; i < aItems.length; i++) {
				sBindingPath = aItems[i].getBindingContextPath();
				oItem = this.getModel("local").getProperty(sBindingPath);
			}
			this.getModel("cancelECCService").callFunction("/CancelShipment", {
				method: "POST",
				urlParameters: {
					Profile: this.sProfile,
					ShipStation: this.sShipStation,
					DocType: sDocType,
					DocTypeDesc: sDocTypeDesc,
					ID: sID,
					TrackingNo: oItem.TrackingNo
				},
				groupId: "ShippmentMassCancel",
				changeSetId: "cancel",
				success: function (oData) {
					this._handleBatchResponseHasError(oData);
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (this.bAllItemSelected) {
						this.byId("idTrackproTabECC").removeAllItems();
						this.byId("idIDInp").setValue("");
						this.byId("idIDInp").setEditable(true);
					} else {
						//else call backend to refresh data
						this.onFilterChange();
					}
					MessageToast.show("Cancel successfully");
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
					//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
					if (this.bAllItemSelected) {
						this.byId("idTrackproTabECC").removeAllItems();
						this.byId("idIDInp").setValue("");
					} else {
						//else call backend to refresh data
						this.onFilterChange();
					}
					this._handleODataError(oError);
				}.bind(this)
			});
		},
		// Michael (22/5/2023) backup logic
		// this.getModel("cancelECCService").submitChanges({
		// 	groupId: "ShippmentMassCancel",
		// 	success: function (oData) {
		// 		this._handleBatchResponseHasError(oData);
		// 		//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
		// 		if (this.bAllItemSelected) {
		// 			this.byId("idTrackproTabECC").removeAllItems();
		// 			this.byId("idIDInp").setValue("");
		// 		} else {
		// 			//else call backend to refresh data
		// 			this.onFilterChange();
		// 		}
		// 		MessageToast.show("Cancel successfully");
		// 		this.hideBusy();
		// 	}.bind(this),
		// 	error: function (oError) {
		// 		this.hideBusy();
		// 		//If all item is selected, by the list should be gone now. Do not refresh data, just clear the table
		// 		if (this.bAllItemSelected) {
		// 			this.byId("idTrackproTabECC").removeAllItems();
		// 			this.byId("idIDInp").setValue("");
		// 		} else {
		// 			//else call backend to refresh data
		// 			this.onFilterChange();
		// 		}
		// 		this._handleODataError(oError);
		// 	}.bind(this)
		// });

		_getFreghUnits: function (sDocType, sID) {
			this.getModel("cancelECCService").callFunction("/GetFreightUnits", {
				method: "GET",
				urlParameters: {
					DocType: sDocType,
					IDs: sID
				},
				success: function (oData) {
					this.byId("idTrackproTabECC").removeSelections();
					this.getModel("local").setProperty("/freightUnitList", oData.results);
					if (oData.results.length > 0) {
						this.getModel("local").setProperty("/Mps", oData.results[0].Mps);
					}
					this.hideBusy();
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