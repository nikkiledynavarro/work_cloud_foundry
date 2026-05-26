sap.ui.define([
	"com/erpis/shiperp/shipewm/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/shipewm/hr7/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/shipewm/hr7/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.shipewm.hr7.controller.Home", {

		formatter: formatter,

		oBundle: null,

		sInputType: "",

		/* =========================================================== */
		/* Lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			//1. When ever user go to the route "home", trigger this._onObjectMatched()
			this.getRouter().getRoute("home").attachPatternMatched(this._onObjectMatched, this);
			this.oBundle = this.getResourceBundle();

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			var oJSONLocalModel = new JSONModel({
				aShippingProfile: [],
				aShippingStation: [],
				aWarehouseNumber: []
			});
			this.setModel(oJSONLocalModel, "local");
        	// Check cookies
			this._checkCookie();
		},

		_onObjectMatched: function () {
			this.getInitScreenShippingInfo(null);
			this.showBusy();
			this.sInputType = "04";
			var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
			if (sWarehouseNumber === 'EWM1' || sWarehouseNumber === '') {
				this.getModel().read("/GetDefaultUserParam", {
					success: function (oData) {
						this.byId("txtStation").setValue(oData.GetDefaultUserParam.shippingstation);
						this.byId("txtProfile").setValue(oData.GetDefaultUserParam.profile);
						this.byId("txtWarehouseNumber").setValue(oData.GetDefaultUserParam.warehouseno);
						this.sInputType = oData.GetDefaultUserParam.input_type;
						this.byId("txtProfile").focus();
						if (oData.GetDefaultUserParam.skiplogin) {
							this.getRouter().navTo("main", {
								Station: oData.GetDefaultUserParam.shippingstation,
								Profile: oData.GetDefaultUserParam.profile,
								InputType: this.sInputType,
								WarehouseNumber: oData.GetDefaultUserParam.warehouseno
							});
						}
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		getInitScreenShippingInfo: function (sWarehouseNumber) {
			var oRequestData = this._generateUsecase(sWarehouseNumber);
			this.showBusy();
			this.getModel().create("/ShippingInfoSet", oRequestData, {
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

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onLogin: function () {
			var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
			var sStation = this.byId("txtStation").getValue();
			var sProfile = this.byId("txtProfile").getValue();
			this.getModel("messageModel").setProperty("/aMessages", []);
			if (sWarehouseNumber === "" || sStation === "" || sProfile === "") {
				MessageBox.error(this.oBundle.getText("loginValidation"));
				return;
			}
			this.showBusy();
			this.getModel().callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					Station: sStation
				},
				success: function () {
					this._setCookie("Station", sStation);
					this._setCookie("Profile", sProfile);
					this._setCookie("InputType", this.sInputType);
					this._setCookie("WarehouseNumber", sWarehouseNumber);
					this.getRouter().navTo("main", {
						Station: sStation,
						Profile: sProfile,
						InputType: this.sInputType,
						WarehouseNumber: sWarehouseNumber
					});
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		onWarehouseNumberRequested: function () {
			this.oShippingWarehouseNumberDlg = Utils.getFragment("", "WarehouseNumberDialog", this);
			this.oShippingWarehouseNumberDlg.open();
		},

		onShippingStationRequested: function () {
			this.oShippingProfileDlg = Utils.getFragment("", "ShippingStationDialog", this);
			this.oShippingProfileDlg.open();
		},

		onShippingProfileRequested: function () {
			this.oShippingProfileDlg = Utils.getFragment("", "ShippingProfileDialog", this);
			this.oShippingProfileDlg.open();
		},

		handleWarehouseNumberValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Lgnum", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleProfileValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Profile", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Shipstation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},
		handleWarehouseNumberValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleStationValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleProfileValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		onWarehouseNumberConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("txtWarehouseNumber");
				oProfileInput.setValue(oSelectedItem.getTitle());
				this.getInitScreenShippingInfo(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingStationConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oStationInput = this.byId("txtStation");
				oStationInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("txtProfile");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		/* =========================================================== */
		/* Internal methods                                             */
		/* =========================================================== */

		_checkCookie: function () {
			var sWarehouseNumber = this._getCookie("WarehouseNumber");
			var sStation = this._getCookie("Station");
			var sProfile = this._getCookie("Profile");
			var sInputType = this._getCookie("InputType");
			if (sWarehouseNumber === "" || sStation === "" || sProfile === "" || sInputType === "") {
				return;
			}

			var sRegex = /[|\\~^:,;?!&%$@*+#<>_(-)=]/;
			if (sRegex.test(sStation)) {
				return;
			}

			if (isNaN(sStation)) {
				this.getRouter().navTo("main", {
					Station: sStation,
					Profile: sProfile,
					InputType: sInputType,
					WarehouseNumber: sWarehouseNumber
				});
			} else {
				return;
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

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		}
	});
});