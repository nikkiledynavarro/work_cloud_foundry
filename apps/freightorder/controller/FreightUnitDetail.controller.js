/*global location*/
sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/freightorder/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"com/erpis/shiperp/freightorder/common/Utils",
	"com/erpis/shiperp/freightorder/common/HttpHelper"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Utils, HttpHelper) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorder.controller.FreightUnitDetail", {

		formatter: formatter,
		oBundle: null, // i18n bundle class
		oPayAmtDialog: null,
		sFilterKey: "A",
		// Commonly used header properties
		sVendor: "",
		sInvoiceNo: "",
		sAccountNo: "",
		sCarrier: "",
		sCompanyCode: "",

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function (oEvent) {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				aMessages: [],
				messagesLength: 0,
				FreightUnitNumber: ""
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("freightUnitDetail").attachPatternMatched(this._onObjectMatched, this);

		},

		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			//this.checkSapUi5Version(this.byId("tblFreightUnitDetail"));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
			this.oVModel = this.getModel("local");
			this.sFreightUnit = oEvent.getParameter("arguments").FreightUnitNumber;
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			if (this.sFreightUnit) {
				this.oVModel.setProperty("/FreightUnitNumber", this.sFreightUnit);
				this.getModel().metadataLoaded().then(function () {

					this._bindView(this.sFreightUnit);
				}.bind(this));
			} else {
				this.showBusy();
				this.getRouter().navTo("freightUnit", {
					Station: this.sStation,
					Profile: this.sProfile
				});
			}

		},

		onReloadTest: function () {
			this._bindView(this.sFreightUnit);
		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sFreightUnit to bound get Freight Unit Item
		 * @private
		 */
		_bindView: function (sFreightUnit) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "xSERPTMxFreightUnitItemSet?$filter=FreightUnitNumber eq '" + sFreightUnit + "'";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					// var aTestData = [{
					// 	"ItemCat": "AVR",
					// 	"ItemKey": "005056A538091EDBAFD4AF442170266A",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Vehicle Resource",
					// 	"ItemCatDesc": "",
					// 	"Item": "1000000   ",
					// 	"ProductDesc": "",
					// 	"Product": "",
					// 	"Quantity": "",
					// 	"UoM": "",
					// 	"GrossWeight": "",
					// 	"GrossWeightUoM": "",
					// 	"GrossVolumnUoM": "",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "00000000000000000000000000000000"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5466D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 60 Pallets",
					// 	"ItemCatDesc": "",
					// 	"Item": "60",
					// 	"ProductDesc": "Pallet",
					// 	"Product": "LES-PALLET",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "64,0928411435827",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF442170266A"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5666D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 40 Box",
					// 	"ItemCatDesc": "",
					// 	"Item": "40",
					// 	"ProductDesc": "Carton",
					// 	"Product": "LES-CARTON",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "19,072",
					// 	"GrossWeightUoM": "KG",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF8FA5B5466D"
					// }, {
					// 	"ItemCat": "PRD",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5866D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Product 20 Electronic (ID point material)",
					// 	"ItemCatDesc": "",
					// 	"Item": "20",
					// 	"ProductDesc": "Electronic (ID point material)",
					// 	"Product": "LES-120",
					// 	"Quantity": "2",
					// 	"UoM": "EA",
					// 	"GrossWeight": " 2",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF8FA5B5666D"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5A66D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 50 Pallets",
					// 	"ItemCatDesc": "",
					// 	"Item": "50",
					// 	"ProductDesc": "Pallet",
					// 	"Product": "LES-PALLET",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "54,0926647736291",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF442170266A"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5C66D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 30 Box",
					// 	"ItemCatDesc": "",
					// 	"Item": "30",
					// 	"ProductDesc": "Carton",
					// 	"Product": "LES-CARTON",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "14,536",
					// 	"GrossWeightUoM": "KG",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF8FA5B5A66D"
					// }, {
					// 	"ItemCat": "PRD",
					// 	"ItemKey": "005056A538091EDBAFD4AF8FA5B5E66D",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Product 10 Electronic (ID point material)",
					// 	"ItemCatDesc": "",
					// 	"Item": "10",
					// 	"ProductDesc": "Electronic (ID point material)",
					// 	"Product": "LES-120",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": " 1",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF8FA5B5C66D"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EEBB2E4D778E0C600C9",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 90 Pallets",
					// 	"ItemCatDesc": "",
					// 	"Item": "90",
					// 	"ProductDesc": "Pallet",
					// 	"Product": "LES-PALLET",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "64,0928411435827",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EDBAFD4AF442170266A"
					// }, {
					// 	"ItemCat": "PKG",
					// 	"ItemKey": "005056A538091EEBB2E4D778E0C620C9",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Package 80 Box",
					// 	"ItemCatDesc": "",
					// 	"Item": "80",
					// 	"ProductDesc": "Carton",
					// 	"Product": "LES-CARTON",
					// 	"Quantity": "1",
					// 	"UoM": "EA",
					// 	"GrossWeight": "19,072",
					// 	"GrossWeightUoM": "KG",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EEBB2E4D778E0C600C9"
					// }, {
					// 	"ItemCat": "PRD",
					// 	"ItemKey": "005056A538091EEBB2E4D778E0C640C9",
					// 	"RootKey": "005056A538091EDBAFD4AF442170066A",
					// 	"ItemId": "Product 70 Electronic (ID point material)",
					// 	"ItemCatDesc": "",
					// 	"Item": "70",
					// 	"ProductDesc": "Electronic (ID point material)",
					// 	"Product": "LES-120",
					// 	"Quantity": "2",
					// 	"UoM": "EA",
					// 	"GrossWeight": " 2",
					// 	"GrossWeightUoM": "LB",
					// 	"GrossVolumnUoM": "003",
					// 	"FreightOrderNumber": "500000718",
					// 	"ParentKey": "005056A538091EEBB2E4D778E0C620C9"
					// }];
					// var oTableData = this._buildTreeStructer(aTestData, "unititems");

					var oTableData = this._buildTreeStructer(oData.d.results, "unititems");
					oInitDeferred.resolve(oTableData);
				}
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
			$.when(oInitDeferred).done(function (data) {
				this.getModel("local").setProperty("/FreightUnitItem", data.item);
				this.hideBusy();
			}.bind(this));

		},
		onNavBackToFreightUnitScreen: function () {
				this.showBusy();
				this.getRouter().navTo("freightUnit", {
					Station: this.sStation ? this.sStation : "1",
					Profile: this.sProfile ? this.sProfile : "1"
				});
			} //end
	});
});