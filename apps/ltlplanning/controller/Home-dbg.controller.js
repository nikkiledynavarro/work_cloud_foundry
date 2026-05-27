sap.ui.define([
	"com/erpis/shiperp/hr7/ltlplanning/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/ltlplanning/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/ltlplanning/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.ltlplanning.controller.Home", {

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
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
			// Set Cookie
			this._setCookie("skiplogin", "1");
			// Check cookies
			this._checkCookie();
		},

		_onObjectMatched: function () {
			this.showBusy();
			this.getModel().read("/GetDefaultUserParam", {
				success: function (oData) {
					var sData = oData.GetDefaultUserParam;
					this.byId("txtStation").setValue(sData.shipStation);
					this.byId("txtProfile").setValue(sData.profile);
					this.byId("txtProfile").focus();
					if (sData.shipStation === "" || sData.profile === "") {
						MessageBox.error(this.oBundle.getText("showMessageError"));
						return;
					}
					var sStation = this._getCookie("skiplogin");
					if (sStation === sData.skiplogin) {
						this._setCookie("skiplogin", "");
						if (sData.skiplogin === "1") {
							this.getRouter().navTo("main", {
								ShipStation: sData.shipStation,
								Profile: sData.profile
							});
						}
					}
					this.hideBusy();
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onLogin: function () {
			var sStation = this.byId("txtStation").getValue();
			var sProfile = this.byId("txtProfile").getValue();
			this.getModel("messageModel").setProperty("/aMessages", []);
			if (sStation === "" || sProfile === "") {
				MessageBox.error(this.oBundle.getText("loginValidation"));
				return;
			}
			this.showBusy();
			this.getModel().callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					ShipStation: sStation
				},
				success: function () {
					this._setCookie("ShipStation", sStation);
					this._setCookie("Profile", sProfile);
					this._setCookie("skiplogin", "");
					this.getRouter().navTo("main", {
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

		onShippingStationRequested: function () {
			this.oShippingProfileDlg = Utils.getFragment("", "ShippingStationDialog", this);
			this.oShippingProfileDlg.open();
		},

		onShippingProfileRequested: function () {
			this.oShippingProfileDlg = Utils.getFragment("", "ShippingProfileDialog", this);
			this.oShippingProfileDlg.open();
		},

		handleProfileValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Profile", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("ShipStation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleProfileValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
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
		/* Internal methods                                            */
		/* =========================================================== */
		_checkCookie: function () {
			var sStation = this._getCookie("ShipStation");
			var sProfile = this._getCookie("Profile");

			if (sStation === "" || sProfile === "") {
				return;
			}
			var sRegex = /^[_A-z0-9]*((-|\s)*[_A-z0-9])*$/;
			if (!sRegex.test(sStation)) {
				return;
			}
			if (isNaN(sStation)) {
				return;
			} else {
				this.getRouter().navTo("main", {
					ShipStation: sStation,
					Profile: sProfile
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

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		}
	});
});