/*global location*/
sap.ui.define([
	"com/erpis/shiperp/planshipment/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/planshipment/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"com/erpis/shiperp/planshipment/common/Utils",
	"com/erpis/shiperp/planshipment/common/HttpHelper"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, Utils, HttpHelper) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.planshipment.controller.Vehicle.AssignDeliveries", {

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
				messagesLength: 0
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("assignDeliveries").attachPatternMatched(this._onObjectMatched, this);

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
			var oData = this.getOwnerComponent().getModel("DeliveriesModel").getProperty("/Deliveries");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			if (oData) {
				this.getModel("local").setProperty("/TransportationUnits", oData.TuNum);
				this.getModel().metadataLoaded().then(function () {
					this._bindView(oData);
				}.bind(this));
			} else {
				this.showBusy();
				this.getRouter().navTo("assignTUs", {
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
		_bindView: function (obj) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "VehicleNoQuerySet?$expand=AssignedDeliveries&$filter=VehNum eq '" + obj.VehNum +
				"' and Vehicle_Act_No eq '" + obj.VehSrActNum + "'";
			var fnSuccess = function (oData) {
				this.hideBusy();
				var aData = oData.d.results[0];
				var aAssignedDeliveries = aData.AssignedDeliveries.results;
				if (aAssignedDeliveries.length > 0) {
					var oTableData = this._buildTreeStructerVehicle(aAssignedDeliveries, "noitems");
					oInitDeferred.resolve(oTableData);
				}
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
			$.when(oInitDeferred).done(function (data) {
				this.getModel("local").setProperty("/Veh_AssignedDeliveries", data.item);
				this.hideBusy();
			}.bind(this));
		},
		// --------  Navigate to the Vehicle page ------------
		onNavBack: function () {
			this.showBusy();
			this.getRouter().navTo("assignTUs", {
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		},
		//end
	});
});