sap.ui.define([
	"com/erpis/shiperp/sls/freightordersls/controller/BaseController",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/sls/freightordersls/model/formatter",
	"com/erpis/shiperp/sls/freightordersls/common/Utils",
	"com/erpis/shiperp/sls/freightordersls/common/HttpHelper",
	"com/erpis/shiperp/sls/freightordersls/common/AttachmentUtils",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, Controller, JSONModel, Filter, FilterOperator, formatter, Utils, HttpHelper, AttachmentUtils, MessageBox,
	MessageToast) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.freightordersls.controller.FreightOrderDetailItem", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetailItem
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
			this.getRouter().getRoute("freightOrderDetailItem").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetailItem
		 */
		//	onBeforeRendering: function() {
		//
		//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetailItem
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.FreightOrderDetailItem
		 */
		//	onExit: function() {
		//
		//	}

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.sFreightOrder = oEvent.getParameter("arguments").FreightOrderNumber;
			this.oVModel.setProperty("/FreightOrderNumber", this.sFreightOrder);

			this._getInitData(this.sFreightOrder);

		},
		_getInitData: function (freightOrderNumber) {
			this.showBusy();
			var oRootFOItem = this.getFreightOrderItemData(freightOrderNumber);
			console.log("Current Carrier:" + oRootFOItem.Carrier);
			console.log("Current Carrier Srv:" + oRootFOItem.CarrierService);
			var oGeneralDataDeferred = this._getGeneralData(freightOrderNumber);
			var oShipFromDataDeferred = this._getShipFromData(freightOrderNumber);
			var oShipToDataDeferred = this._getShipToData(freightOrderNumber);
			var oPackedDetailDeferred = this._getPackageDetailData(freightOrderNumber);
			$.when(oGeneralDataDeferred, oShipFromDataDeferred, oShipToDataDeferred, oPackedDetailDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		},
		_getGeneralData: function (freightOrderNumber) {
			console.log("Gọi general");
			var oGeneralDataDeferred = $.Deferred();
			var sGeneralDataPath = this.getMainSrv() + "xSERPTMxFODetailItemGeneralSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.getModel("local").setProperty("/FODetailItemGeneral", oData.d.results);
					oGeneralDataDeferred.resolve();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);

				}
				this.hideBusy();
				oGeneralDataDeferred.reject(oError);
			}.bind(this);
			HttpHelper.getData(sGeneralDataPath, fnSuccess, fnError);
			return oGeneralDataDeferred.promise();
		},
		_getShipFromData: function (freightOrderNumber) {
			console.log("Gọi ship from");
			var oShipFromDeferred = $.Deferred();
			var sShipFromPath = this.getMainSrv() + "xSERPTMxFODetailItemShipFromSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.getModel("local").setProperty("/FODetailItemShipFrom", oData.d.results);
					oShipFromDeferred.resolve();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);
				}
				this.hideBusy();
				oShipFromDeferred.reject(oError);
			}.bind(this);
			HttpHelper.getData(sShipFromPath, fnSuccess, fnError);
			return oShipFromDeferred.promise();
		},
		_getShipToData: function (freightOrderNumber) {
			console.log("Gọi ship to");
			var oShipToDeferred = $.Deferred();
			var sShipToPath = this.getMainSrv() + "xSERPTMxFODetailItemShipToSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.getModel("local").setProperty("/FODetailItemShipTo", oData.d.results);
					oShipToDeferred.resolve();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);

				}
				this.hideBusy();
				oShipToDeferred.reject(oError);
			}.bind(this);
			HttpHelper.getData(sShipToPath, fnSuccess, fnError);
			return oShipToDeferred.promise();

		},
		_getPackageDetailData: function (freightOrderNumber) {
			console.log("Gọi package");
			var oPackageDetailDeferred = $.Deferred();
			var sPackageDetailPath = this.getMainSrv() + "xSERPTMxFODetailItemPackageDetailSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.getModel("local").setProperty("/FODetailItemPackageDetails", oData.d.results);
					oPackageDetailDeferred.resolve();
				}
			}.bind(this);
			var fnError = function (oError) {
				if (oError) {
					MessageBox.show(oError);

				}
				this.hideBusy();
				oPackageDetailDeferred.reject(oError);
			}.bind(this);
			HttpHelper.getData(sPackageDetailPath, fnSuccess, fnError);
			return oPackageDetailDeferred.promise();

		},
		onHandleChangeData: function () {

		},
		onHandleCloseScreen: function () {
			var sConfirmTitle = this.oBundle.getText("foItemCloseConfirmTitle");
			var sConfirmMsg = this.oBundle.getText("foItemCloseConfirmMsg");
			MessageBox.confirm(sConfirmMsg, {
				title: sConfirmTitle,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						console.log("Save data");
					}
					if (oAction === MessageBox.Action.NO) {
						this.onNavToFreightOrderList();
					}
				}.bind(this)
			});
		},
		onNavToFreightOrderList: function () {
				this.showBusy();
				this.getRouter().navTo("freightOrder", {
					Station: "1",
					Profile: "1"
				}, false);
			} //end

	});

});