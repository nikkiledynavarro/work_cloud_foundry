sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/freightorder/model/formatter",
	"com/erpis/shiperp/freightorder/common/Utils",
	"com/erpis/shiperp/freightorder/common/HttpHelper",
	"com/erpis/shiperp/freightorder/common/AttachmentUtils",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, Controller, JSONModel, Filter, FilterOperator, formatter, Utils, HttpHelper, AttachmentUtils, MessageBox,
	MessageToast) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorder.controller.RequestForPickup", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.freightorder.view.RequestForPickup
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
			var oEventArgs = oEvent.getParameter("arguments");
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.sFreightOrderNumber = oEventArgs.FreightOrderNumber;
			this._getInitData();
			this.aUserUploadFiles = [];
			if (this.byId("FileUpload") !== undefined) {
				this.aUserUploadFiles = [];
				this.byId("FileUpload").removeAllItems();
			}
			this.getRouter().navTo("requestForPickup", {
				FreightOrderNumber: this.sFreightOrderNumber,
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
			var aPickupHeaders = this.getModel("local").getProperty("/RequestPickupHeaders");
			var oSubmitData = {
				PickupDetail: aPickupDetails,
				PickupHeader: aPickupHeaders
			};
			var aPayloadFiles = [];
			if (this.aUserUploadFiles.length > 0) {
				var aFiles = AttachmentUtils._buildAttachmentForUpload(this.aUserUploadFiles);
				var oFile;
				aFiles.forEach(function (item) {
					oFile = {
						filesize: item.info.FileSize,
						filetype: item.info.FileType,
						filename: item.info.FileName,
						hexdata: item.data
					};
					aPayloadFiles.push(oFile);
				});
				// AttachmentUtils.uploadAttachment(aFiles, aPickupDetails, this);
			}
			// var sSendEmailUrl = this.getMainSrv() + "xSERPTMxFORequestPickupDetailSet";
			var bCheck = this.checkValidateBeforeSendEmail(oSubmitData.PickupHeader[0]);
			if (!bCheck) {
				MessageBox.show("Please input all mandatory fields before sending email!");
				this.hideBusy();
				return;
			}
			var requestPayload = this.generateRequestPickupSendDataPayload(oSubmitData, aPayloadFiles);
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					if (oData.Messages.results) {
						MessageBox.success("Send Email Successfully", {
							title: "Success"
						});
						this.hideBusy();
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
		checkValidateBeforeSendEmail: function (oData) {
			if (oData) {
				if (!oData.CarrierContact || oData.CarrierContact === "" || !oData.CarrierEmail || oData.CarrierEmail === "" || !oData.CarrierPhone ||
					oData.CarrierPhone === "" || !oData.CustomerContact || oData.CustomerContact === "" || !oData.CustomerEmail || oData.CustomerEmail ===
					"" || !oData.CustomerEmail || oData.CustomerEmail === "") {
					return false;
				}
			} else {
				return false;
			}
			return true;
		},
		generateRequestPickupSendDataPayload: function (oSubmitData, aPayloadFiles) {
			var oPayload;
			var oRequestPickupIn = {
				Cname1: oSubmitData.PickupHeader[0].CarrierContact,
				Cemail: oSubmitData.PickupHeader[0].CarrierEmail,
				Ctelf1: oSubmitData.PickupHeader[0].CarrierPhone,
				Ctelfx: oSubmitData.PickupHeader[0].CarrierFax ? oSubmitData.PickupHeader[0].CarrierFax : "",
				Dname1: oSubmitData.PickupHeader[0].CustomerContact,
				Demail: oSubmitData.PickupHeader[0].CustomerEmail,
				Dtelf1: oSubmitData.PickupHeader[0].CustomerPhone,
				Dtelfx: oSubmitData.PickupHeader[0].CustomerFax ? oSubmitData.PickupHeader[0].CustomerFax : "",
				Pudate: oSubmitData.PickupHeader[0].PickupDate ? Utils.convertDatetoYYYYMMDDHHMMSSFormat(oSubmitData.PickupHeader[0].PickupDate) : "",
				Putime: oSubmitData.PickupHeader[0].PickupTime ? Utils.convertTimetoEdmTimeFormat(oSubmitData.PickupHeader[0].PickupTime) : "",
				Doornumr: oSubmitData.PickupHeader[0].DoorNumber ? oSubmitData.PickupHeader[0].DoorNumber : "",
				Dockopen: oSubmitData.PickupHeader[0].DoorOpenTime ? Utils.convertTimetoEdmTimeFormat(oSubmitData.PickupHeader[0].DoorOpenTime) : "",
				Dockclos: oSubmitData.PickupHeader[0].DoorCloseTime ? Utils.convertTimetoEdmTimeFormat(oSubmitData.PickupHeader[0].DoorCloseTime) : "",
				Text: oSubmitData.PickupHeader[0].Text ? oSubmitData.PickupHeader[0].Text : ""
			};
			if (oRequestPickupIn.Pudate === "") {
				delete oRequestPickupIn.Pudate;
			}
			if (oRequestPickupIn.Putime === "") {
				delete oRequestPickupIn.Putime;
			}
			if (oRequestPickupIn.Dockopen === "") {
				delete oRequestPickupIn.Dockopen;
			}
			if (oRequestPickupIn.Dockclos === "") {
				delete oRequestPickupIn.Dockclos;
			}
			if (aPayloadFiles && aPayloadFiles.length > 0) {
				oPayload = {
					Action: "RequestPickupSendEmail",
					Messages: [],
					ShippingProfile: this.sProfile,
					ShippingStation: this.sStation,
					FreightOrderNumber: this.sFreightOrderNumber,
					RequestPickupIn: oRequestPickupIn,
					Attachments: aPayloadFiles
				};
			} else {
				oPayload = {
					Action: "RequestPickupSendEmail",
					Messages: [],
					ShippingProfile: this.sProfile,
					ShippingStation: this.sStation,
					FreightOrderNumber: this.sFreightOrderNumber,
					RequestPickupIn: oRequestPickupIn
				};
			}
			return oPayload;
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
					if (oData.d.results.length == 0) {
						oData.d.results.push({});
					}
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
			var oFreightOrder = this.generateFreightOrderData(this.getModel("appView").getProperty("/SelectedFreightOrder"));
			var requestPickupDetailPayload = {
				Action: "FreightOrderDetails",
				Messages: [],
				PackageDetails: [],
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightOrders: [oFreightOrder]
			};
			this.getModel().create("/FUFOQuerySet", requestPickupDetailPayload, {
				success: function (oData) {
					if (oData.PackageDetails.results) {
						// var oTableData = this._buildTreeStructer(oData.d.results);
						this.getModel("local").setProperty("/RequestPickupDetails", oData.PackageDetails.results);
						oPickupDetailDeferred.resolve();
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
		}, //end
		generateFreightOrderData: function (oFreightOrderData) {
			delete oFreightOrderData.__metadata;
			return oFreightOrderData;
		}
	});

});