/*global location*/
sap.ui.define([
	"com/erpis/shiperp/hr7/tuv/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/hr7/tuv/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/tuv/common/Utils",
	"com/erpis/shiperp/hr7/tuv/common/HttpHelper"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Utils, HttpHelper) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.tuv.controller.TU.AssignTUs", {

		formatter: formatter,
		oBundle: null, // i18n bundle class

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
				VehNum: ""
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("assignTUs").attachPatternMatched(this._onObjectMatched, this);

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
			var oEventArgs = oEvent.getParameter("arguments");
			var oVehNo = this.getOwnerComponent().getModel("vehicleModel").getProperty("/Vehicle");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			if (oVehNo) {
				this.getModel("local").setProperty("/VehNum", oVehNo.VehNum);
				this.getModel().metadataLoaded().then(function () {
					this._bindView(oVehNo);
				}.bind(this));
			} else {
				this.showBusy();
				this.getRouter().navTo("availableVehicle", {
					Station: this.sStation,
					Profile: this.sProfile,
					WarehouseNumber: this.sWarehouseNumber
				});
			}
		},

		// onReloadTest: function () {
		// 	this._bindView(this.sVehNum);
		// },
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sVehNum to bound get Freight Unit Item
		 * @private
		 */
		_bindView: function (sVehNo) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "VehicleNoQuerySet?$expand=AssignedTUs&$filter=VehNum eq '" + sVehNo.VehNum +
				"' and Vehicle_Act_No eq '" + sVehNo.VehSrActNum + "'";
			var fnSuccess = function (oData) {
				this.hideBusy();
				var aData = oData.d.results[0];
				var aAssignedTUs = aData.AssignedTUs.results;
				if (aAssignedTUs.length > 0) {
					var oTableData = this._buildTreeStructerTUs(aAssignedTUs, "noitems");
					oInitDeferred.resolve(oTableData);
				}
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
			$.when(oInitDeferred).done(function (data) {
				this.getModel("local").setProperty("/Veh_AssginedHus", data.item);
				this.hideBusy();
			}.bind(this));
		},

		onNavBackScreen: function () {
			this.showBusy();
			// --------  Navigate to the Vehicle page ------------
			this.getRouter().navTo("availableVehicle", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},

		onAssigedDelivPressed: function (oEvent) {
			this.showBusy();
			var oVehicleNo = this.getOwnerComponent().getModel("vehicleModel").getProperty("/Vehicle");
			var oLineData = oEvent.getSource().getBindingContext("local").getObject();
			oLineData.VehNum = oVehicleNo.VehNum;
			//---------  set data to Deliveries page ------
			this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel({
				Deliveries: oLineData
			}), "DeliveriesModel");
			// --------  Navigate to the Deliveries page ------------
			this.getRouter().navTo("assignDeliveries", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},
		//end
	});
});