sap.ui.define([
	"com/erpis/shiperp/sls/cancelshipment/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/sls/cancelshipment/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/Link",
	"sap/ui/core/MessageType",
	"com/erpis/shiperp/sls/cancelshipment/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, MessageToast, MessageBox, MessagePopover,
	MessagePopoverItem, Link, MessageType, Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.cancelshipment.controller.Login", {
		/* =========================================================== */
		/* Global variables for this view                              */
		/* =========================================================== */

		//Link to "com.erpis.shiperp.sls.cancelshipment.model.formatter" for formatter functions
		formatter: formatter,
		oBundle: null,

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			//1. When ever user go to the route "disputeList", trigger this._onObjectMatched()
			this.getRouter().getRoute("login").attachPatternMatched(this._onObjectMatched, this);

			//2. Create message model
			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			var oJSONLocalModel = new JSONModel({
				aShippingProfile: [],
				aShippingStation: [],
				aWarehouseNumber: [],
				AppCancel: ""
			});
			this.setModel(oJSONLocalModel, "local");

			//3. Assign resource bundle
			this.oBundle = this.getResourceBundle();
			// 4. check cookie App Parcel 
			var sWarehouseNumber = Utils._getCookie("WarehouseNumber");
			if (sWarehouseNumber === "") {
				this._checkCookieParcel();
			} else {
				// 5. check cookie Cancel app ship EWM
				this._checkCookie();
			}

		},

		_checkCookieParcel: function () {
			var sStation = Utils._getCookie("Station");
			var sProfile = Utils._getCookie("Profile");
			var sWarehouseNumber = Utils._getCookie("WarehouseNumber");
			var sAppCancel = Utils._getCookie("AppCancel");
			if (sStation === "" || sProfile === "" || !sAppCancel) {
				return;
			}
			this.AppCancel = sAppCancel;
			if (sAppCancel === "ECC") {
				this.getRouter().navTo("cancelDetailECC", {
					ShipStation: sStation,
					Profile: sProfile
				});
			} else {
				this.getRouter().navTo("cancelDetailEWM", {
					ShipStation: sStation,
					Profile: sProfile,
					WarehouseNumber: sWarehouseNumber
				});
			}
		},

		_checkCookie: function () {
			var sStation = Utils._getCookie("Station");
			var sProfile = Utils._getCookie("Profile");
			var sWarehouseNumber = Utils._getCookie("WarehouseNumber");
			var sAppCancel = Utils._getCookie("AppCancel");
			if (sStation === "" || sProfile === "" || !sAppCancel) {
				return;
			}
			this.AppCancel = sAppCancel;
			if (sAppCancel === "ECC") {
				if (!sWarehouseNumber) {
					return;
				}
				this.getRouter().navTo("cancelDetailECC", {
					ShipStation: sStation,
					Profile: sProfile
				});
			} else {
				if (!sWarehouseNumber) {
					return;
				}
				this.getRouter().navTo("cancelDetailEWM", {
					ShipStation: sStation,
					Profile: sProfile,
					WarehouseNumber: sWarehouseNumber
				});
			}
		},

		_getCookie: function (sName) {
			var name = sName + "=";
			var decodedCookie = decodeURIComponent(document.cookie);
			var ca = decodedCookie.split(";");
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) === " ") {
					c = c.substring(1);
				}
				if (c.indexOf(name) === 0) {
					return c.substring(name.length, c.length);
				}
			}
			return "";
		},

		onChangeAppCancel: function () {
			this.AppCancel = this.byId("cbCategoryApp").getSelectedKey();
			if (this.AppCancel === "EWM") {
				this._getDefaultUserParamEWM();
			} else {
				this._getDefaultUserParamECC();
			}
		},

		_onObjectMatched: function () {
			if (this.AppCancel) {
				this.byId("cbCategoryApp").setSelectedKey(this.AppCancel);
				if (this.AppCancel === "EWM") {
					this._getDefaultUserParamEWM();
				} else {
					this._getDefaultUserParamECC();
				}
			}
		},

		onWarehouseNumberRequested: function () {
			if (!this.AppCancel) {
				return;
			} else {
				this.oShippingWarehouseNumberDlg = Utils.getFragment("", "EWM.WarehouseNumberDialog", this);
				this.oShippingWarehouseNumberDlg.open();
			}
		},

		onShippingStationRequested: function () {
			if (this.AppCancel === "") {
				return;
			} else if (this.AppCancel === "EWM") {
				this.oShippingProfileDlg = Utils.getFragment("", "EWM.ShippingStationDialog", this);
			} else {
				this.oShippingProfileDlg = Utils.getFragment("", "ECC.ShippingStationDialog", this);
			}
			this.oShippingProfileDlg.open();
		},

		onShippingProfileRequested: function () {
			if (this.AppCancel === "") {
				return;
			} else if (this.AppCancel === "EWM") {
				this.oShippingProfileDlg = Utils.getFragment("", "EWM.ShippingProfileDialog", this);
			} else {
				this.oShippingProfileDlg = Utils.getFragment("", "ECC.ShippingProfileDialog", this);
			}
			this.oShippingProfileDlg.open();
		},

		// ECC APP --- Cancel Shipment for Parcel App
		getInitScreenShippingInfo: function (sWarehouseNumber) {
			var oRequestData = this._generateUsecase(sWarehouseNumber);
			this.showBusy();
			this.getModel("cancelEWMService").create("/ShippingInfoSet", oRequestData, {
				success: function (oData) {
					if (oData) {
						this.getModel("local").setProperty("/aShippingProfile", oData.EWMProfile.results);
						this.getModel("local").setProperty("/aShippingStation", oData.EWMStation.results);
						this.getModel("local").setProperty("/aWarehouseNumber", oData.EWMWarehouseNumber.results);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateUsecase: function (sWarehouseNumber) {
			var oData = {
				WarehouseNumber: (sWarehouseNumber) ? sWarehouseNumber : "",
				EWMProfile: [],
				EWMStation: [],
				EWMWarehouseNumber: []
			};
			return oData;
		},

		handleWarehouseNumberValueHelpSearchEWM: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Lgnum", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleProfileValueHelpSearchECC: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Profile", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleProfileValueHelpSearchEWM: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Profile", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpSearchEWM: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Shipstation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpSearchECC: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("ShipStation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},
		handleWarehouseNumberValueHelpCloseEWM: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleStationValueHelpCloseEWM: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleStationValueHelpCloseECC: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleProfileValueHelpCloseEWM: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleProfileValueHelpCloseECC: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		onWarehouseNumberConfirmEWM: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("txtWarehouseNumber");
				oProfileInput.setValue(oSelectedItem.getTitle());
				this.getInitScreenShippingInfo(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingStationConfirmEWM: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oStationInput = this.byId("idShippingStationInp");
				oStationInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingStationConfirmECC: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oStationInput = this.byId("idShippingStationInp");
				oStationInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirmEWM: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("idShippingProfileInp");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirmECC: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("idShippingProfileInp");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onLoginButtonPressed: function () {
			this.getModel("messageModel").setProperty("/aMessages", []);
			var sStation = this.byId("idShippingStationInp").getValue();
			var sProfile = this.byId("idShippingProfileInp").getValue();
			var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
			if (this.AppCancel === "EWM") {
				if (sProfile === "" || sStation === "" || !sWarehouseNumber) {
					MessageBox.error(this.oBundle.getText("errorMissingValueLoginMsg"));
					return;
				}
				this._loginEWM(sProfile, sStation, sWarehouseNumber);
			} else {
				if (sProfile === "" || sStation === "") {
					MessageBox.error(this.oBundle.getText("errorMissingValueLoginMsg"));
					return;
				}
				this._loginECC(sProfile, sStation, sWarehouseNumber);
			}
		},

		_loginECC: function (sProfile, sStation, sWarehouseNumber) {
			this.showBusy();
			this.getModel("cancelECCService").callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					Station: sStation
				},
				success: function () {
					Utils._setCookie("Station", sStation);
					Utils._setCookie("Profile", sProfile);
					Utils._setCookie("WarehouseNumber", sWarehouseNumber);
					Utils._setCookie("AppCancel", this.AppCancel);
					this.getRouter().navTo("cancelDetailECC", {
						ShipStation: sStation,
						Profile: sProfile
					});
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_loginEWM: function (sProfile, sStation, sWarehouseNumber) {
			this.showBusy();
			this.getModel("cancelEWMService").callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					Station: sStation
				},
				success: function () {
					Utils._setCookie("Station", sStation);
					Utils._setCookie("Profile", sProfile);
					Utils._setCookie("WarehouseNumber", sWarehouseNumber);
					Utils._setCookie("AppCancel", this.AppCancel);
					this.getRouter().navTo("cancelDetailEWM", {
						ShipStation: sStation,
						Profile: sProfile,
						WarehouseNumber: sWarehouseNumber
					});
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */

		_getDefaultUserParamEWM: function () {
			this.getInitScreenShippingInfo(null);
			this.showBusy();
			this.getModel("cancelEWMService").read("/GetDefaultUserParam", {
				success: function (oData) {
					this.byId("idShippingStationInp").setValue(oData.GetDefaultUserParam.shippingstation);
					this.byId("idShippingProfileInp").setValue(oData.GetDefaultUserParam.profile);
					this.byId("txtWarehouseNumber").setValue(oData.GetDefaultUserParam.warehouseno);
					this.byId("idShippingProfileInp").focus();
					if (oData.GetDefaultUserParam.skiplogin) {
						this.getRouter().navTo("cancelDetailEWM", {
							Station: oData.GetDefaultUserParam.shippingstation,
							Profile: oData.GetDefaultUserParam.profile,
							WarehouseNumber: oData.GetDefaultUserParam.warehouseno
						});
					}
					this.hideBusy();
				}.bind(this)
			});
		},

		_getDefaultUserParamECC: function () {
			this.showBusy();
			this.getModel("cancelECCService").read("/GetDefaultUserParam", {
				success: function (oData) {
					this.byId("idShippingStationInp").setValue(oData.GetDefaultUserParam.shippingstation);
					this.byId("idShippingProfileInp").setValue(oData.GetDefaultUserParam.profile);
					this.byId("idShippingProfileInp").focus();
					this.hideBusy();
				}.bind(this)
			});
		}
	});

	// EWM APP --- Cancel Shipment for Ship EWM App

});