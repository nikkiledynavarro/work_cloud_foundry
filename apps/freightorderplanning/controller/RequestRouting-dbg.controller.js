sap.ui.define([
	"com/erpis/shiperp/freightorderplanning/controller/BaseController",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"com/erpis/shiperp/freightorderplanning/model/formatter",
	"com/erpis/shiperp/freightorderplanning/common/Utils",
	"com/erpis/shiperp/freightorderplanning/common/HttpHelper",
	"sap/m/MessageBox"
], function (BaseController, Controller, JSONModel, Filter, formatter, Utils, HttpHelper, MessageBox) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorderplanning.controller.RequestRouting", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.freightorderplanning.view.RequestRouting
		 */
		onInit: function (oEvent) {
			this.hideBusy();
			var oViewModel = new JSONModel();
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("requestRouting").attachPatternMatched(this._onObjectMatched, this);
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
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.getRouter().navTo("requestRouting", {
				Station: this.sStation,
				Profile: this.sProfile
			});
			this._getInitData();
		},
		onNavBackToFreightOrderScreen: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},
		/*
		 * Internal function
		 */
		_getInitData: function (oEvent) {
			this.showBusy();
			var oInitHeaderDeferred = $.Deferred();
			var oInitDetailDeferred = $.Deferred();
			/*
			 * *Trigger hhtp request for fetching data Header*
			 */
			var sRequestHeaderUrl = this.getMainSrv() + "xSERPTMxFORequestRoutingHeaderSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					// var oTableData = this._buildTreeStructer(oData.d.results);
					this.getModel("local").setProperty("/RequestRoutingHeaders", oData.d.results);
					oInitHeaderDeferred.resolve();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);
					this.hideBusy();
					return;
				}
			}.bind(this);
			HttpHelper.getData(sRequestHeaderUrl, fnSuccess, fnError);
			/*
			 * *Trigger hhtp request for fetching data Header*
			 */
			var sRequestDetailUrl = this.getMainSrv() + "xSERPTMxFORequestRoutingDetailSet";
			fnSuccess = function (oData) {
				if (oData.d.results) {
					// var oTableData = this._buildTreeStructer(oData.d.results);
					this.getModel("local").setProperty("/RequestRoutingDetails", oData.d.results);
					oInitDetailDeferred.resolve();
				}
			}.bind(this);
			fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);
					this.hideBusy();
					return;
				}
			}.bind(this);
			HttpHelper.getData(sRequestDetailUrl, fnSuccess, fnError);
			$.when(oInitHeaderDeferred, oInitDetailDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		}
	});
});