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

	return BaseController.extend("com.erpis.shiperp.planshipment.controller.ODO.DocumentNoDetail", {

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
				DocumentNo: ""
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("documentNoDetail").attachPatternMatched(this._onObjectMatched, this);

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
			this.sDocumentNo = oEventArgs.DocumentNo;
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sWarehouseNumber = oEventArgs.WarehouseNumber;
			if (this.sDocumentNo) {
				this.oVModel.setProperty("/DocumentNo", this.sDocumentNo);
				this.getModel().metadataLoaded().then(function () {
					this._bindView(this.sDocumentNo);
				}.bind(this));
			} else {
				this.showBusy();
				this.getRouter().navTo("outbounddeliveryorder", {
					Station: this.sStation,
					Profile: this.sProfile,
					WarehouseNumber: this.sWarehouseNumber
				});
			}

		},

		onReloadTest: function () {
			this._bindView(this.sDocumentNo);
		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sDocumentNo to bound get Freight Unit Item
		 * @private
		 */
		_bindView: function (sDocumentNo) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "ODODocNoQuerySet?$expand=ODOhus,ODOItems&$filter=DocumentNo eq '" + sDocumentNo + "'";
			var fnSuccess = function (oData) {
				this.hideBusy();
				var aData = oData.d.results[0];
				var aODOItems = aData.ODOItems.results;
				if (aODOItems.length > 0) {
					var oTableData = this._buildTreeStructer(aODOItems, "noitems");
					oInitDeferred.resolve(oTableData);
				}
				this.getModel("local").setProperty("/HandlingUnits", aData.ODOhus.results);
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
			$.when(oInitDeferred).done(function (data) {
				this.getModel("local").setProperty("/DocumentNoItem", data.item);
				this.hideBusy();
			}.bind(this));

		},
		onNavBackToODOScreen: function () {
				this.showBusy();
				this.getRouter().navTo("outbounddeliveryorder", {
					Station: this.sStation,
					Profile: this.sProfile,
					WarehouseNumber: this.sWarehouseNumber
				});
			} //end
	});
});