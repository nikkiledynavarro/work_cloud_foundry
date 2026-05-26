sap.ui.define([
	"com/erpis/shiperp/hr7/tuv/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/tuv/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/hr7/tuv/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.tuv.controller.Home", {

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
			var oJSONLocalModel = new JSONModel({
				aShippingProfile: [],
				aShippingStation: [],
				aWarehouseNumber: []
			});
			this.setModel(oJSONLocalModel, "local");
			// Set Cookie
			this._setCookie("skiplogin", "X");
			// Check cookies
			this._checkCookie();
		},

		_onObjectMatched: function () {
			this.getInitScreenShippingInfo(null);
			this.showBusy();
			var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
			if (sWarehouseNumber === 'EWM1' || sWarehouseNumber === '') {
				this.getModel().read("/GetDefaultUserParam", {
					success: function (oData) {
						var sData = oData.GetDefaultUserParam;
						this.sLandingPage = sData.LoadingPage;
						this.byId("txtStation").setValue(sData.ShipStation);
						this.byId("txtProfile").setValue(sData.Profile);
						this.byId("txtWarehouseNumber").setValue(sData.WarehouseNumber);
						this.byId("txtProfile").focus();
						if (sData.ShipStation === "" || sData.Profile === "") {
							MessageBox.error(this.oBundle.getText("showMessageError"));
							return;
						}
						var sStation = this._getCookie("skiplogin");
						if (sStation === sData.SkipLogin) {
							this._setCookie("skiplogin", "");
							// Plan to TU screen
							if (sData.SkipLogin === "X" && sData.LoadingPage === "TU") {
								this.getRouter().navTo("outbounddeliveryorder", {
									Station: sData.ShipStation,
									Profile: sData.Profile,
									WarehouseNumber: sData.WarehouseNumber,
									LandingPage: sData.LoadingPage
								});
								// Plan to Vehicle screen
							} else if (sData.SkipLogin === "X" && sData.LoadingPage === "VEH") {
								this.getRouter().navTo("availableTus", {
									Station: sData.ShipStation,
									Profile: sData.Profile,
									WarehouseNumber: sData.WarehouseNumber,
									LandingPage: sData.LoadingPage
								});
							}
						}
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		getInitScreenShippingInfo: function (sWarehouseNumber) {
			var oRequestData = this._generateUsecase(sWarehouseNumber);
			this.showBusy();
			this.getModel().create("/TuvListSet", oRequestData, {
				success: function (oData) {
					if (oData) {
						var aData = oData.tu_init_screen.response;
						this.getModel("local").setProperty("/aShippingProfile", aData.et_profile.results);
						this.getModel("local").setProperty("/aShippingStation", aData.et_shipstation.results);
						this.getModel("local").setProperty("/aWarehouseNumber", aData.et_lgnum.results);
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
				action: "",
				tu_init_screen: {
					dummy: "",
					request: {
						iv_lgnum: "",
						iv_profile: "",
						iv_shipstation: ""
					},
					response: {
						dummy: "",
						et_lgnum: [],
						et_profile: [],
						et_shipstation: []
					}
				}
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
					Station: sStation,
					WarehouseNumber: sWarehouseNumber
				},
				success: function () {
					this._setCookie("Station", sStation);
					this._setCookie("Profile", sProfile);
					this._setCookie("WarehouseNumber", sWarehouseNumber);
					this._setCookie("skiplogin", "");
					// Plan to Vehicle screen
					if (this.sLandingPage === "VEH") {
						this.getRouter().navTo("availableTus", {
							Station: sStation,
							Profile: sProfile,
							WarehouseNumber: sWarehouseNumber,
							LandingPage: this.sLandingPage
						});
					} else {
						this.getRouter().navTo("outbounddeliveryorder", {
							Station: sStation,
							Profile: sProfile,
							WarehouseNumber: sWarehouseNumber,
							LandingPage: this.sLandingPage
						});
					}
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
				// this.getInitScreenShippingInfo(oSelectedItem.getTitle());
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
			if (sWarehouseNumber === "" || sStation === "" || sProfile === "") {
				return;
			}

			var sRegex = /[|\\~^:,;?!&%$@*+#<>_(-)=]/;
			if (sRegex.test(sStation)) {
				return;
			}

			if (isNaN(sStation)) {
				return;
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