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

	return BaseController.extend("com.erpis.shiperp.sls.freightordersls.controller.RequestForPickup", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.sls.freightordersls.view.RequestForPickup
		 */
		onInit: function () {
			this.hideBusy();
			// Local Model for view
			var oViewModel = new JSONModel({
				ProductSet: []
			});
			this.setModel(oViewModel, "local");
			this.getRouter().getRoute("requestForPickup").attachPatternMatched(this._onObjectMatched, this);
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
			this._getInitData();
			this.aUserUploadFiles = [];
			if (this.byId("FileUpload") !== undefined) {
				this.aUserUploadFiles = [];
				this.byId("FileUpload").removeAllItems();
			}
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.getRouter().navTo("requestForPickup", {
				Station: this.sStation,
				Profile: this.sProfile
			});

		},

		onNavBackToFreightOrderScreen: function (oEvent) {
			this.showBusy();
			this.getRouter().navTo("freightOrder", {
				Station: this.sStation,
				Profile: this.sProfile
			});
		},

		onUploadUserFileChange: function (oEvent) {
			var oUploadCollection = oEvent.getSource();
			var aFiles = oEvent.getParameter("files");
			if (aFiles.length > 0) {
				for (var i = 0; i < aFiles.length; i++) {
					AttachmentUtils._handleUploadUserProfilesAttachmentChange(oUploadCollection, aFiles[i], this);
				}
			}
		},

		onSendEmailPressed: function () {
			this.showBusy();
			var aPickupDetails = this.getModel("local").getProperty("/RequestPickupDetails");
			var oSubmitData = {
				PickupDetail: aPickupDetails
			};
			if (this.aUserUploadFiles.length > 0) {
				var aFiles = AttachmentUtils._buildAttachmentForUpload(this.aUserUploadFiles);
				AttachmentUtils.uploadAttachment(aFiles, aPickupDetails, this);
			} else {
				var sSendEmailUrl = this.getMainSrv() + "xSERPTMxFORequestPickupDetailSet";
				var fnSuccess = function (oData) {
					if (oData.d.results) {
						MessageBox.show("Send Email Successfully");
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
				HttpHelper.postData(sSendEmailUrl, oSubmitData, fnSuccess, fnError);
			}
		},
		/*
		 * Internal function
		 */
		_getInitData: function (oEvent) {
				this.showBusy();
				/*Fetching data Request Pickup*/
				var oPickupDeferred = $.Deferred();
				var sRequestPickupUrl = this.getMainSrv() + "xSERPTMxFORequestPickupSet";
				var fnSuccess = function (oData) {
					if (oData.d.results) {
						// var oTableData = this._buildTreeStructer(oData.d.results);
						this.getModel("local").setProperty("/RequestPickupHeaders", oData.d.results);
						oPickupDeferred.resolve();
					}
				}.bind(this);
				var fnError = function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						return;
					}
				}.bind(this);
				HttpHelper.getData(sRequestPickupUrl, fnSuccess, fnError);

				/*Fetching Request Pickup Detail*/
				var oPickupDetailDeferred = $.Deferred();
				var sRequestPickupDetailUrl = this.getMainSrv() + "xSERPTMxFORequestPickupDetailSet";
				fnSuccess = function (oData) {
					if (oData.d.results) {
						// var oTableData = this._buildTreeStructer(oData.d.results);
						this.getModel("local").setProperty("/RequestPickupDetails", oData.d.results);
						oPickupDetailDeferred.resolve();
					}
				}.bind(this);
				fnError = function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						return;
					}
				}.bind(this);
				HttpHelper.getData(sRequestPickupDetailUrl, fnSuccess, fnError);

				$.when(oPickupDeferred, oPickupDetailDeferred).done(function () {
					var aRequestPickupDetails = this.getModel("local").getProperty("/RequestPickupDetails");
					var sTotalPallet = 0;
					var sTotalWeight = 0;
					// (+) Added by Tim 13/1/2022
					if (aRequestPickupDetails && aRequestPickupDetails.length > 0) {
						var sWeightUnit = aRequestPickupDetails[0].WeightUnit;
						aRequestPickupDetails.forEach(function (item) {
							sTotalPallet = sTotalPallet + parseInt(item.Pallet, 10);
							sTotalWeight = sTotalWeight + parseFloat(item.Weight);

						});
					}

					this.getModel("local").setProperty("/TotalCounts", [{
						TotalPallet: sTotalPallet.toString(),
						TotalWeight: sTotalWeight.toString(),
						TotalWeightUnit: sWeightUnit
					}]);
					this.hideBusy();
				}.bind(this));
			} //end

	});

});