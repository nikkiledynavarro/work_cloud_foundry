sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/freightorder/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/freightorder/common/Utils",
	"com/erpis/shiperp/freightorder/common/HttpHelper",
	"sap/ui/core/MessageType"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, HttpHelper, MessageType) {
	"use strict";
	var oEntity = {
		RateQuoteEntity: "xSERPTMxFORateQuoteSet",
		RateQuoteFUEntity: "xSERPTMxFORateQuoteFreightUnitSet",
		RateQuoteErrorEntity: "xSERPTMxFORateQuoteErrorSet"
	};
	return BaseController.extend("com.erpis.shiperp.freightorder.controller.RateQuote", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.freightorder.view.RateQuote
		 */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				FreightOrder: "",
				RatesCount: "0",
				FreightUnitsCount: "0",
				ErrorsCount: "0"
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("rateQuote").attachPatternMatched(this._onObjectMatched, this);

		},

		_onObjectMatched: function (oEvent) {
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.getModel("local").setProperty("/RateQuoteItems", []);
			this.getModel("local").setProperty("/RatesCount", 0);
			this.getModel("local").setProperty("/RateQuoteErrors", []);
			this.getModel("local").setProperty("/ErrorsCount", 0);
			this._getInitData();
		},

		onNavBackToFreightOrderScreen: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: "1",
				Profile: "1"
			}, false);
		},
		onSelectIconTab: function (oEvent) {
			// this.showBusy();
			var oSelectedTab = oEvent.getParameters("key");
			var sSelectedKey = oSelectedTab.selectedKey;
			// var sEntity = "";
			// var sCountProperty = "";
			// var sDataProperty = "";
			// if (sSelectedKey === "Rate") {
			// 	this.byId("tblRateQuoteItem").getBinding("items").refresh();
			// } else if (sSelectedKey === "FreightUnit") {
			// 	this.byId("tblRateQuoteFUItem").getBinding("items").refresh();
			// } else {
			// 	this.byId("ictRateQuote").getBinding("items").refresh();
			// }
			// this._getCountByTab(sSelectedKey, sEntity, sDataProperty, sCountProperty);
		},
		/*
		 * Internal function
		 */
		_getInitData: function (oEvent) {
			this.showBusy();
			var oRQFUDeferred = $.Deferred();
			var oRQEDeferred = $.Deferred();
			var oRQDeferred = $.Deferred();
			/*
			 * *Trigger hhtp request for fetching data Header*
			 */
			// var sRateQuoteFUUrl = this.getMainSrv() + "xSERPTMxFORateQuoteFreightUnitSet";
			// var fnSuccess = function (oData) {
			// 	if (oData.d.results) {
			// 		// var oTableData = this._buildTreeStructer(oData.d.results);
			// 		this.getModel("local").setProperty("/RateQuoteFreightUnits", oData.d.results);
			// 		this.getModel("local").setProperty("/FreightUnitsCount", oData.d.results.length);
			// 		oRQFUDeferred.resolve();
			// 	}
			// }.bind(this);
			// var fnError = function (oError) {
			// 	if (oError) {
			// 		MessageBox.show(oError);
			// 		this.hideBusy();
			// 		return;
			// 	}
			// }.bind(this);
			// HttpHelper.getData(sRateQuoteFUUrl, fnSuccess, fnError);
			/*
			 * *Trigger hhtp request for fetching data Header*
			 */
			// var sRateQuoteErrorUrl = this.getMainSrv() + "xSERPTMxFORateQuoteErrorSet";
			// fnSuccess = function (oData) {
			// 	if (oData.d.results) {
			// 		// var oTableData = this._buildTreeStructer(oData.d.results);
			// 		this.getModel("local").setProperty("/RateQuoteErrors", oData.d.results);
			// 		this.getModel("local").setProperty("/ErrorsCount", oData.d.results.length);
			// 		oRQEDeferred.resolve();
			// 	}
			// }.bind(this);
			// fnError = function (oError) {
			// 	if (oError) {
			// 		MessageBox.show(oError);
			// 		this.hideBusy();
			// 		return;
			// 	}
			// }.bind(this);
			// HttpHelper.getData(sRateQuoteErrorUrl, fnSuccess, fnError);
			/*
			 * *Trigger hhtp request for fetching data Header*
			 */
			// var sRateQuoteUrl = this.getMainSrv() + "xSERPTMxFORateQuoteSet";
			// fnSuccess = function (oData) {
			// 	if (oData.d.results) {
			// 		// var oTableData = this._buildTreeStructer(oData.d.results);
			// 		this.getModel("local").setProperty("/RateQuoteItems", oData.d.results);
			// 		this.getModel("local").setProperty("/RatesCount", oData.d.results.length);
			// 		oRQDeferred.resolve();
			// 	}
			// }.bind(this);
			// fnError = function (oError) {
			// 	if (oError) {
			// 		MessageBox.show(oError);
			// 		this.hideBusy();
			// 		return;
			// 	}
			// }.bind(this);
			// HttpHelper.getData(sRateQuoteUrl, fnSuccess, fnError);
			var requestPayload = this.generateRateQuoteDataPayload();
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					this.hideBusy();
					if (oData.CarrierRates.results.length > 0) {
						this.getModel("local").setProperty("/RateQuoteItems", oData.CarrierRates.results);
						this.getModel("local").setProperty("/RatesCount", oData.CarrierRates.results.length);
					}
					if (oData.Return.results.length > 0) {
						this.getModel("local").setProperty("/RateQuoteErrors", oData.Return.results);
						this.getModel("local").setProperty("/ErrorsCount", oData.Return.results.length);
					}
				}.bind(this),
				error: function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						return;
					}
				}.bind(this)
			});
		},

		generateRateQuoteDataPayload: function () {
			var oFreightOrder = this.getModel("appView").getProperty("/SelectedFreightOrder");
			delete oFreightOrder.__metadata;
			var oPayload = {
				Action: "RateQuote",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightOrders: [oFreightOrder],
				Multiple: this.getModel("appView").getProperty("/Multiple") ? this.getModel("appView").getProperty("/Multiple") : false,
				Optimize: this.getModel("appView").getProperty("/Optimization") ? this.getModel("appView").getProperty("/Optimization") : false,
				CarrierRates: [],
				PricProCarrServ: [],
				Return: []
			};
			return oPayload;
		},

		_getCountByTab: function (sSelectedKey, sEntity, sDataProperty, sCountProperty) {
			var sDataTabUrl = this.getMainSrv() + sEntity;
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.getModel("local").setProperty(sDataProperty, oData.d.results);
					this.getModel("local").setProperty(sCountProperty, oData.d.results.length);
					this.hideBusy();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);
					this.hideBusy();
					return;
				}
			}.bind(this);
			HttpHelper.getData(sDataTabUrl, fnSuccess, fnError);
		}
	});

});