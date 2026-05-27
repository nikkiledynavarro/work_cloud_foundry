sap.ui.define([
	"com/erpis/shiperp/hr7/tuv/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/tuv/model/formatter",
	"com/erpis/shiperp/hr7/tuv/common/HttpHelper"
], function (BaseController, JSONModel, formatter, HttpHelper) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.tuv.controller.ODO.OutboundDeliveryOrderDetail", {

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
			this.getRouter().getRoute("outboundDeliveryOrderDetail").attachPatternMatched(this._onObjectMatched, this);
		},

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
				this.getRouter().navTo("outboundDeliveryOrderDetail", {
					DocumentNo: this.sDocumentNo,
					Station: this.sStation,
					Profile: this.sProfile,
					WarehouseNumber: this.sWarehouseNumber
				});
			}

		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sDocumentNo to bound get Outbound Delivery Order Detail
		 * @private
		 */
		_bindView: function (sDocumentNo) {
			this.showBusy();
			var oInitDeferred = $.Deferred();
			var sRequestUrl = this.getMainSrv() + "ODODetailsSet?$filter=DocumentNo eq '" + sDocumentNo + "'";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					var oJSONModel = new JSONModel(
						oData.d.results[0]
					);
					this.setModel(oJSONModel, "ODODetails");
					this.hideBusy();
				}
			}.bind(this);
			HttpHelper.getData(sRequestUrl, fnSuccess);
		},

		onNavBackToODOScreen: function () {
			this.showBusy();
			this.getRouter().navTo("outbounddeliveryorder", {
				DocumentNo: this.sDocumentNo,
				Station: this.sStation,
				Profile: this.sProfile,
				WarehouseNumber: this.sWarehouseNumber
			});
		}
	});
});