sap.ui.define([
	"com/erpis/shiperp/sls/freightordersls/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/sls/freightordersls/common/Utils",
	"com/erpis/shiperp/sls/freightordersls/common/HttpHelper",
	"com/erpis/shiperp/sls/freightordersls/model/formatter"
], function (BaseController, JSONModel, Utils, HttpHelper, formatter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.freightordersls.controller.FreightOrderDetail", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetail
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				FreightOrderNumber: ""
			});

			this.setModel(oViewModel, "local");
			this.oVModel = this.getModel("local");
			this.getRouter().getRoute("freightOrderDetail").attachPatternMatched(this._onObjectMatched, this);

		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.sFreightOrder = oEvent.getParameter("arguments").FreightOrderNumber;
			this.oVModel.setProperty("/FreightOrderNumber", this.sFreightOrder);
			this._bindView(this.sFreightOrder);
			// var sPath = jQuery.sap.getModulePath("com.erpis.shiperp.sls.freightordersls", "/model/FreightOrderDetail.json");
			// this.oVModel.loadData(sPath);
			// this.oVModel.attachRequestCompleted(function () {

			// 	oThis.oVModel.setProperty("/FreightOrder", oThis.sFreightOrder);
			// 	oThis.hideBusy();

			// });

		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sFreightUnit to bound get Freight Unit Item
		 * @private
		 */
		_bindView: function (sFreightOrder) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "xSERPTMxFreightOrderItemSet?$filter=FreightOrderNumber eq '" + sFreightOrder + "'";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					var oTableData = this._buildTreeStructer(oData.d.results, "orderitems");
					// var oTableData = this._buildTreeStructer(aTestdata);
					this.getModel("local").setProperty("/FreightOrderItem", oTableData.item);
					oInitDeferred.resolve();
				}
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
			$.when(oInitDeferred).done(function () {

				this.hideBusy();
			}.bind(this));

		},

		onNavBackToFreightOrderScreen: function (oEvent) {
				this.showBusy();
				this.getRouter().navTo("freightOrder", {
					Station: "1",
					Profile: "1"
				}, false);
			}
			/**
			 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
			 * (NOT before the first rendering! onInit() is used for that one!).
			 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetail
			 */
			//	onBeforeRendering: function() {
			//
			//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetail
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetail
		 */
		//	onExit: function() {
		//
		//	}

	});

});