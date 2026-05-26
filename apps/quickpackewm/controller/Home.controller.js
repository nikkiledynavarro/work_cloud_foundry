sap.ui.define([
	"com/erpis/shiperp/hr7/quickpackewm/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/quickpackewm/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/quickpackewm/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.quickpackewm.controller.Home", {

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
			//1. When ever user go to the route "home", trigger this._onObjectMatched()
			this.getRouter().getRoute("home").attachPatternMatched(this._onObjectMatched, this);
			this.oBundle = this.getResourceBundle();

			// Initialize Message Model
			this.setModel(new JSONModel({
				aMessages: [],
				messagesLength: 0
			}), "messageModel");

			// Initialize local Model
			this.setModel(new JSONModel({}), "local");

			// Set Cookie
			this._setCookie("SkipLogin", true);
			// Check cookies
			this._checkCookie();
		},

		_onObjectMatched: function () {
			this.showBusy();
			var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
			if (sWarehouseNumber === 'EWM1' || sWarehouseNumber === '') {
				this.getModel().read("/GetDefaultUserParam", {
					success: function (oData) {
						this.byId("txtStation").setValue(oData.GetDefaultUserParam.Station);
						this.byId("txtProfile").setValue(oData.GetDefaultUserParam.Profile);
						this.byId("txtWarehouseNumber").setValue(oData.GetDefaultUserParam.WarehouseNumber);
						this.byId("txtProfile").focus();
						// if (oData.GetDefaultUserParam.Station === "" || oData.GetDefaultUserParam.Profile === "") {
						// 	MessageBox.error(this.oBundle.getText("showMessageError"));
						// 	return;
						// }
						// Get filter station
						this._GetFilterStation(oData.GetDefaultUserParam.WarehouseNumber);
						// Check skip login
						var sSkipLogin = this._getCookie("SkipLogin");
						if (sSkipLogin === oData.GetDefaultUserParam.SkipLogin.toString()) {
							this._setCookie("SkipLogin", false);
							if (oData.GetDefaultUserParam.SkipLogin) {
								this.getRouter().navTo("main", {
									Station: oData.GetDefaultUserParam.Station,
									Profile: oData.GetDefaultUserParam.Profile,
									WarehouseNumber: oData.GetDefaultUserParam.WarehouseNumber
								});
							}
						}
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		_GetFilterStation: function (sWarehouseNumber) {
			this.getModel().read("/xSERPERPxCDS_QP_STATION", {
				filters: [
					new Filter("SysIdFilter", "EQ", sWarehouseNumber),
				],
				success: function (oData) {
					this.getModel("local").setProperty("/ShipStation", oData.results);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

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
					Station: sStation,
					WarehouseNumber: sWarehouseNumber,
				},
				success: function () {
					this._setCookie("Station", sStation);
					this._setCookie("Profile", sProfile);
					this._setCookie("WarehouseNumber", sWarehouseNumber);
					this._setCookie("SkipLogin", false);
					this.getRouter().navTo("main", {
						Station: sStation,
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
				this.byId("txtWarehouseNumber").setValue(oSelectedItem.getTitle());
				// Get filter station
				this._GetFilterStation(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingStationConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				this.byId("txtStation").setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				this.byId("txtProfile").setValue(oSelectedItem.getTitle());
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
			if (sWarehouseNumber === "" || sStation === "" || sProfile === "") {
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