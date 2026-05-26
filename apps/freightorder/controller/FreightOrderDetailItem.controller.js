sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/freightorder/model/formatter",
	"com/erpis/shiperp/freightorder/common/Utils",
	"com/erpis/shiperp/freightorder/common/MessageUtils",
	"com/erpis/shiperp/freightorder/common/HttpHelper",
	"com/erpis/shiperp/freightorder/common/AttachmentUtils",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, Controller, JSONModel, Filter, FilterOperator, formatter, Utils, MessageUtils, HttpHelper, AttachmentUtils,
	MessageBox,
	MessageToast) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorder.controller.FreightOrderDetailItem", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.erpis.shiperp.freightorder.view.FreightOrderDetailItem
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
			// Message Model for message return
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			this.getRouter().getRoute("freightOrderDetailItem").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf com.erpis.shiperp.freightorder.view.FreightOrderDetailItem
		 */
		//	onBeforeRendering: function() {
		//
		//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf com.erpis.shiperp.freightorder.view.FreightOrderDetailItem
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf com.erpis.shiperp.freightorder.view.FreightOrderDetailItem
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
			var oEventArgs = oEvent.getParameter("arguments");
			this.sFreightOrder = oEventArgs.FreightOrderNumber;
			this.sStation = oEventArgs.Station;
			this.sProfile = oEventArgs.Profile;
			this.oVModel.setProperty("/FreightOrderNumber", this.sFreightOrder);
			this.setModel(new JSONModel({
				Countries: []
			}), "foCountry");
			this.setModel(new JSONModel({
				BillOptions: []
			}), "foBillOption");
			this.getCountryData();
			this.getBillOptionData();
			this._getInitData(this.sFreightOrder);
		},
		_getInitData: function (freightOrderNumber) {
			this.showBusy();
			var oRootFOItem = this.getFreightOrderItemData(freightOrderNumber);
			var oDetailDeferred = this._getFreightOriderDetailData(freightOrderNumber);
			$.when(oDetailDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		},
		_getFreightOriderDetailData: function (freightOrderNumber) {
			var oPackageDetailDeferred = $.Deferred();
			var oFreightOrder = this.getModel("appView").getProperty("/NavFreightOrder");
			delete oFreightOrder.__metadata;
			var requestPickupDetailPayload = {
				Action: "FreightOrderDetails",
				Messages: [],
				PackageDetails: [],
				GenInfo: {},
				ShipFrom: {},
				ShipTo: {},
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightOrders: [oFreightOrder]
			};
			this.getModel().create("/FUFOQuerySet", requestPickupDetailPayload, {
				success: function (oData) {
					if (oData.ShipFrom) {
						this.getModel("local").setProperty("/FODetailItemShipFrom", oData.ShipFrom);
						if (oData.ShipFrom.Country) {
							this.getRegionData(oData.ShipFrom.Country, "From");
						}
					} else {
						this.getModel("local").setProperty("/FODetailItemShipFrom", {});
					}
					if (oData.ShipTo) {
						this.getModel("local").setProperty("/FODetailItemShipTo", oData.ShipTo);
						if (oData.ShipTo.Country) {
							this.getRegionData(oData.ShipTo.Country, "To");
						}
					} else {
						this.getModel("local").setProperty("/FODetailItemShipTo", {});
					}
					if (oData.GenInfo) {
						this.getModel("local").setProperty("/FODetailItemGeneral", oData.GenInfo);
					} else {
						this.getModel("local").setProperty("/FODetailItemGeneral", {});
					}
					if (oData.PackageDetails.results) {
						this.getModel("local").setProperty("/FODetailItemPackageDetails", oData.PackageDetails.results);
						if (oData.GenInfo.Carrier) {
							this.getCarrierServiceData(oData.GenInfo.Carrier);
						}
						var aRequestPickupDetails = oData.PackageDetails.results;
						var sTotalPallet = 0;
						var sTotalWeight = 0;
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
						oPackageDetailDeferred.resolve();
					}
				}.bind(this),
				error: function (oError) {
					if (oError) {
						MessageBox.show(oError);
						this.hideBusy();
						oPackageDetailDeferred.reject(oError);
					}
				}.bind(this)
			});
			return oPackageDetailDeferred.promise();
		},
		onHandleChangeData: function () {

		},
		onCarrierChange: function (oEvent) {
			var sSelectedCarrier = oEvent.getSource().getSelectedKey();
			this.getCarrierServiceData(sSelectedCarrier);
		},
		onCountryFromChange: function (oEvent) {
			var sSelectedCountry = oEvent.getSource().getSelectedKey();
			this.getRegionData(sSelectedCountry, "From");
		},
		onCountryToChange: function (oEvent) {
			var sSelectedCountry = oEvent.getSource().getSelectedKey();
			this.getRegionData(sSelectedCountry, "To");
		},
		getBillOptionData: function () {
			var oBillOptionDef = $.Deferred();
			var sRequestQuery = this.getMainSrv() + "xSERPTMxBillOptionSet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					if (oData.d.results.length > 100) {
						this.getModel("foBillOption").setSizeLimit(oData.d.results.length);
					}
					this.getModel("foBillOption").setProperty("/BillOptions", oData.d.results);
					oBillOptionDef.resolve();
				}
			}.bind(this);
			var fnError = function (oData) {
				oBillOptionDef.reject();
			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
			return oBillOptionDef.promise();
		},
		getCountryData: function () {
			var oCountryDef = $.Deferred();
			var sRequestQuery = this.getMainSrv() + "xSERPTMxCountrySet";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					if (oData.d.results.length > 100) {
						this.getModel("foCountry").setSizeLimit(oData.d.results.length);
					}
					this.getModel("foCountry").setProperty("/Countries", oData.d.results);
					oCountryDef.resolve();
				}
			}.bind(this);
			var fnError = function (oData) {
				oCountryDef.reject();
			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
			return oCountryDef.promise();
		},
		getRegionData: function (sCountry, sType) {
			var aRegions = [];
			var oRegionDef = $.Deferred();
			var sRequestQuery = this.getMainSrv() + "xSERPTMxRegionSet";
			if (!Utils.isEmpty(sCountry)) {
				sRequestQuery = this.getMainSrv() + "xSERPTMxRegionSet" + "?$filter=Land1 eq '" + sCountry + "'";
			}
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					aRegions = oData.d.results;
					if (sType === "From") {
						this.getModel("local").setProperty("/RegionFrom", aRegions);
					} else {
						this.getModel("local").setProperty("/RegionTo", aRegions);
					}
					oRegionDef.resolve(aRegions);
				}
			}.bind(this);
			var fnError = function (oData) {
				oRegionDef.reject();
			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
			return oRegionDef.promise();
		},
		getCarrierServiceData: function (carrierId) {
			var aCarrierServices = [];
			var oCarrierSrvDef = $.Deferred();
			var sRequestQuery = this.getMainSrv() + "xSERPTMxFODDCarrierServiceSet";
			if (!Utils.isEmpty(carrierId)) {
				sRequestQuery = this.getMainSrv() + "xSERPTMxFODDCarrierServiceSet" + "?$filter=Carrier eq '" + carrierId + "'";
			}
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					aCarrierServices = oData.d.results;
					this.getModel("local").setProperty("/CarrierService", aCarrierServices);
					oCarrierSrvDef.resolve(aCarrierServices);
				}
			}.bind(this);
			var fnError = function (oData) {
				oCarrierSrvDef.reject();
			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
			return oCarrierSrvDef.promise();

		},
		onHandleCloseScreen: function () {
			var bCheck = this.checkRequiredDataBeforeSave();
			if (!bCheck) {
				MessageBox.warning("Please input all required fields before save FreightOrder!");
				return;
			}
			this.showBusy();
			var requestToleranceCheckPayload = this.generateToleranceCheckDataPayload();
			this.getModel().create("/FUFOQuerySet", requestToleranceCheckPayload, {
				success: function (oData) {
					var bContinue = true;
					if (oData.Return.results.length > 0) {
						bContinue = false;
						var aMsg = MessageUtils._generateMessages(oData.Return.results);
						MessageUtils._addMessage(aMsg, this);
						var bHasErrorMessCheckTolerance = false;
						for (var i = 0; i < aMsg.length; i++) {
							if (aMsg[i].type == "Error") {
								bHasErrorMessCheckTolerance = true;
							}
						}
						if (bHasErrorMessCheckTolerance) {
							MessageBox.error(
								"Can't close Freight Order. Please click the button in the bottom left corner of the screen to see the errors!", {
									title: "Error"
								});
							this.hideBusy();
							return;
						} else {
							bContinue = true;
						}
					}
					if (bContinue) {
						var requestPayload = this.generateCloseFreightOrderDataPayload();
						this.getModel().create("/FUFOQuerySet", requestPayload, {
							success: function (oData1) {
								this.hideBusy();
								var that = this;
								if (oData1.Return.results.length > 0) {
									var aMsgClose = MessageUtils._generateMessages(oData1.Return.results);
									MessageUtils._addMessage(aMsgClose, that);
									var bHasErrorMess = false;
									for (var j = 0; j < aMsgClose.length; j++) {
										if (aMsgClose[j].type == "Error") {
											bHasErrorMess = true;
										}
									}
									if (bHasErrorMess) {
										MessageBox.error(
											"Can't close Freight Order. Please click the button in the bottom left corner of the screen to see the errors!", {
												title: "Error"
											});
										return;
									} else {
										var sMessage = "";
										if (aMsgClose.length > 0) {
											for (var k = 0; k < aMsgClose.length; k++) {
												sMessage += "- " + aMsgClose[k].title + "\n";
											}
										} else {
											sMessage = "Close Freight Order Successfully!";
										}
										MessageBox.success(sMessage, {
											title: "Success",
											onClose: function (oAction) {
												that.onNavToFreightOrderList();
											}
										});
									}
								} else {
									MessageBox.success("Close Freight Order Successfully!", {
										title: "Success",
										onClose: function (oAction) {
											that.onNavToFreightOrderList();
										}
									});
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
					}
					// 
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
		onHandleSaveScreen: function () {
			this.showBusy();
			var requestPayload = this.generateCloseFreightOrderDataPayload();
			requestPayload.Action = "SaveFreightOrder";
			this.getModel().create("/FUFOQuerySet", requestPayload, {
				success: function (oData) {
					var that = this;
					that.hideBusy();
					if (oData.Return.results.length > 0) {
						var aMsgClose = MessageUtils._generateMessages(oData.Return.results);
						MessageUtils._addMessage(aMsgClose, that);
						var bHasErrorMessSave = false;
						for (var i = 0; i < aMsgClose.length; i++) {
							if (aMsgClose[i].type == "Error") {
								bHasErrorMessSave = true;
							}
						}
						if (bHasErrorMessSave) {
							MessageBox.error(
								"Can't save Freight Order. Please click the button in the bottom left corner of the screen to see the errors!", {
									title: "Error"
								});
							return;
						} else {
							MessageBox.success("Save Freight Order Successfully!", {
								title: "Success"
									// onClose: function (oAction) {
									// 	that.onNavToFreightOrderList();
									// }
							});
						}
					} else {
						MessageBox.success("Save Freight Order Successfully!", {
							title: "Success"
								// onClose: function (oAction) {
								// 	that.onNavToFreightOrderList();
								// }
						});
					}
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this.hideBusy();
				}.bind(this)
			});
		},
		checkRequiredDataBeforeSave: function () {
			var oGenInfo = this.getModel("local").getProperty("/FODetailItemGeneral");
			if (!oGenInfo.Carrier || oGenInfo.Carrier == "" || !oGenInfo.Service || oGenInfo.Service == "" || !oGenInfo.ShipDate || oGenInfo.ShipDate ==
				"" || !oGenInfo.ArrivalDate || oGenInfo.ArrivalDate == "" || !oGenInfo.BillOption || oGenInfo.BillOption == "") {
				return false;
			}
			return true;
		},
		generateToleranceCheckDataPayload: function () {
			var oFreightOrder = this.getModel("appView").getProperty("/NavFreightOrder");
			delete oFreightOrder.__metadata;
			var oData = {
				Action: "CheckTolerance",
				Description: "",
				Return: [],
				FreightOrders: [oFreightOrder]
			};
			return oData;
		},
		generateCloseFreightOrderDataPayload: function () {
			var oFreightOrder = this.getModel("appView").getProperty("/NavFreightOrder");
			delete oFreightOrder.__metadata;
			var oGenInfo = this.getModel("local").getProperty("/FODetailItemGeneral");
			var oShipFrom = this.getModel("local").getProperty("/FODetailItemShipFrom");
			var oShipTo = this.getModel("local").getProperty("/FODetailItemShipTo");
			var oData = {
				Action: "CloseFreightOrder",
				ShippingProfile: this.sProfile,
				ShippingStation: this.sStation,
				FreightOrders: [oFreightOrder],
				Return: [],
				GenInfo: {
					Carrier: oGenInfo.Carrier ? oGenInfo.Carrier : "",
					Service: oGenInfo.Service ? oGenInfo.Service : "",
					ArrivalDate: oGenInfo.ArrivalDate ? Utils.convertToStringDate(oGenInfo.ArrivalDate) : "",
					BillOption: oGenInfo.BillOption ? oGenInfo.BillOption : "",
					DeclaredValue: oGenInfo.DeclaredValue ? oGenInfo.DeclaredValue : "",
					InsuredValue: oGenInfo.InsuredValue ? oGenInfo.InsuredValue : "",
					PrepaidAdd: oGenInfo.Prepaid ? oGenInfo.Prepaid : "",
					ShipDate: oGenInfo.ShipDate ? Utils.convertToStringDate(oGenInfo.ShipDate) : "",
					ThirdPartyAccount: oGenInfo.ThirdPartyAccount ? oGenInfo.ThirdPartyAccount : "",
					ThirdPartyCountry: oGenInfo.ThirdPartyCountry ? oGenInfo.ThirdPartyCountry : "",
					ThirdPartyZip: oGenInfo.ThirdPartyZip ? oGenInfo.ThirdPartyZip : ""
				},
				ShipFrom: {
					Name1: oShipFrom.Name1 ? oShipFrom.Name1 : "",
					Name2: oShipFrom.Name2 ? oShipFrom.Name2 : "",
					Street1: oShipFrom.Street1 ? oShipFrom.Street1 : "",
					Street2: oShipFrom.Street2 ? oShipFrom.Street2 : "",
					Street3: oShipFrom.Street3 ? oShipFrom.Street3 : "",
					Street4: oShipFrom.Street4 ? oShipFrom.Street4 : "",
					Telephone: oShipFrom.Phone ? oShipFrom.Phone : "",
					Fax: oShipFrom.Fax ? oShipFrom.Fax : "",
					FedTaxID: oShipFrom.FedTaxID ? oShipFrom.FedTaxID : "",
					StatedTaxID: oShipFrom.StateTaxID ? oShipFrom.StateTaxID : "",
					Country: oShipFrom.Country ? oShipFrom.Country : "",
					Carrier: oShipFrom.Carrier ? oShipFrom.Carrier : "",
					City: oShipFrom.City ? oShipFrom.City : "",
					State: oShipFrom.State ? oShipFrom.State : "",
					PostalCode: oShipFrom.PostalCode ? oShipFrom.PostalCode : ""
				},
				ShipTo: {
					Name1: oShipTo.Name1 ? oShipTo.Name1 : "",
					Name2: oShipTo.Name2 ? oShipTo.Name2 : "",
					Street1: oShipTo.Street1 ? oShipTo.Street1 : "",
					Street2: oShipTo.Street2 ? oShipTo.Street2 : "",
					Street3: oShipTo.Street3 ? oShipTo.Street3 : "",
					Street4: oShipTo.Street4 ? oShipTo.Street4 : "",
					CustomerID: oShipTo.CustomerID ? oShipTo.CustomerID : "",
					Email: oShipTo.Email ? oShipTo.Email : "",
					Telephone: oShipTo.Phone ? oShipTo.Phone : "",
					Fax: oShipTo.Fax ? oShipTo.Fax : "",
					FedTaxID: oShipTo.FedTaxID ? oShipTo.FedTaxID : "",
					StatedTaxID: oShipTo.StateTaxID ? oShipTo.StateTaxID : "",
					Country: oShipTo.Country ? oShipTo.Country : "",
					Carrier: oShipTo.Carrier ? oShipTo.Carrier : "",
					City: oShipTo.City ? oShipTo.City : "",
					State: oShipTo.State ? oShipTo.State : "",
					PostalCode: oShipTo.PostalCode ? oShipTo.PostalCode : ""
				}
			};
			return oData;
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