sap.ui.define([
	"com/erpis/shiperp/trackshipmentewm/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/trackshipmentewm/hr7/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/trackshipmentewm/hr7/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.trackshipmentewm.hr7.controller.Home", {

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
				aWarehouseNumber: [],
				AppTrack: "",
				aControlTypes: [{
					key: "ECC",
					text: "Track Shipment ECC"
				}, {
					key: "EWM",
					text: "Track Shipment EWM"
				}]
			});
			this.setModel(oJSONLocalModel, "local");

			var sWarehouseNumber = this._getCookie("WarehouseNumber");
			var aControlType = this.getModel("local").getProperty("/aControlTypes");
			// check cookie App Parcel 
			if (sWarehouseNumber === "") {
				this._checkCookieParcel(aControlType);
			} else {
				//check cookie Cancel app ship EWM
				this._checkCookie(aControlType);
			}

		},

		_onObjectMatched: function () {
			if (this.AppTrack) {
				if (this.AppTrack === "ECC") {
					this.getDefaultUserParamECC();
				} else {
					this.getDefaultUserParamEWM();
				}
			}
		},

		_checkCookieParcel: function (aControlType) {
			var sStation = this._getCookie("Station");
			var sProfile = this._getCookie("Profile");
			var sAppTrack = this._getCookie("AppTrack");
			this.getModel("local").setProperty("/AppTrackList", aControlType);
			var aSelectParcel = aControlType.filter(function (item) {
				return (item.key === sAppTrack);
			});
			if (aSelectParcel.length > 0) {
				this.getModel("local").setProperty("/AppTrack", aSelectParcel[0].key);
			}
			var sWarehouseNumber = this._getCookie("WarehouseNumber");
			if (sStation === "" || sProfile === "" || !sAppTrack) {
				return;
			}

			this.AppTrack = sAppTrack;
			if (sAppTrack === "ECC") {

				this.getRouter().navTo("mainECC", {
					Station: sStation,
					Profile: sProfile
				});
			} else {

				this.getRouter().navTo("mainEWM", {
					Station: sStation,
					Profile: sProfile,
					WarehouseNumber: sWarehouseNumber
				});
			}
		},

		onChangeAppTrack: function () {
			this.AppTrack = this.byId("cbCategoryApp").getSelectedKey();
			if (this.AppTrack === "EWM") {
				this.getDefaultUserParamEWM();
			} else {
				this.getDefaultUserParamECC();
			}
		},

		getDefaultUserParamECC: function () {
			this.showBusy();
			this.getModel("ECCService").read("/GetDefaultUserParam", {
				success: function (oData) {
					this.byId("txtStation").setValue(oData.GetDefaultUserParam.shippingstation);
					this.byId("txtProfile").setValue(oData.GetDefaultUserParam.profile);
					this.byId("txtProfile").focus();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
				}.bind(this)
			});
		},
		getDefaultUserParamEWM: function () {
			this.getInitScreenShippingInfo(null);
			this.showBusy();
			this.getModel("EWMService").read("/GetDefaultUserParam", {
				success: function (oData) {
					this.byId("txtStation").setValue(oData.GetDefaultUserParam.shippingstation);
					this.byId("txtProfile").setValue(oData.GetDefaultUserParam.profile);
					this.byId("txtWarehouseNumber").setValue(oData.GetDefaultUserParam.warehouseno);
					this.byId("txtProfile").focus();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
				}.bind(this)
			});
		},
		getInitScreenShippingInfo: function (sWarehouseNumber) {
			var oRequestData = this._generateUsecase(sWarehouseNumber);
			this.showBusy();
			this.getModel("EWMService").create("/ShippingInfoSet", oRequestData, {
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
			var sStation = this.byId("txtStation").getValue();
			var sProfile = this.byId("txtProfile").getValue();
			this.getModel("messageModel").setProperty("/aMessages", []);
			if (this.AppTrack === "ECC") {
				if (sStation === "" || sProfile === "") {
					MessageBox.error(this.oBundle.getText("loginValidation"));
					return;
				}
				this.loginECC(sProfile, sStation);
			} else {
				var sWarehouseNumber = this.byId("txtWarehouseNumber").getValue();
				if (sStation === "" || sProfile === "" || sWarehouseNumber === "") {
					MessageBox.error(this.oBundle.getText("loginValidation"));
					return;
				}
				this.loginEWM(sProfile, sStation, sWarehouseNumber);
			}

		},

		loginECC: function (sProfile, sStation) {
			this.showBusy();
			this.getModel("ECCService").callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					Station: sStation
				},
				success: function () {
					this.hideBusy();
					this._setCookie("Station", sStation);
					this._setCookie("Profile", sProfile);

					this.getRouter().navTo("mainECC", {
						Station: sStation,
						Profile: sProfile
					});
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		loginEWM: function (sProfile, sStation, sWarehouseNumber) {
			this.showBusy();
			this.getModel("EWMService").callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					Profile: sProfile,
					Station: sStation
				},
				success: function () {
					this.hideBusy();
					this._setCookie("Station", sStation);
					this._setCookie("Profile", sProfile);
					this.getRouter().navTo("mainEWM", {
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
			if (!this.AppTrack) {
				return;
			} else {
				this.oWarehouseNumDlg = Utils.getFragment("", "EWM.WarehouseNumberDialog", this);
				this.oWarehouseNumDlg.open();
			}
		},

		onShippingStationRequested: function () {
			if (this.AppTrack === "") {
				return;
			} else if (this.AppTrack === "EWM") {
				this.oShippingProfileDlg = Utils.getFragment("", "EWM.ShippingStationDialog", this);
			} else {
				this.oShippingProfileDlg = Utils.getFragment("", "ECC.ShippingStationDialog", this);
			}
			this.oShippingProfileDlg.open();
		},

		onShippingProfileRequested: function () {
			if (this.AppTrack === "") {
				return;
			} else if (this.AppTrack === "EWM") {
				this.oShippingProfileDlg = Utils.getFragment("", "EWM.ShippingProfileDialog", this);
			} else {
				this.oShippingProfileDlg = Utils.getFragment("", "ECC.ShippingProfileDialog", this);
			}
			this.oShippingProfileDlg.open();
		},

		//
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
			var oFilter = new Filter("ShipStation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		//ECC
		handleProfileValueHelpSearchECC: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Profile", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleStationValueHelpSearchECC: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("ShipStation", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},
		//

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
		//ECC
		handleStationValueHelpCloseECC: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		handleProfileValueHelpCloseECC: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},
		//
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

		//ECC
		onShippingStationConfirmECC: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oStationInput = this.byId("txtStation");
				oStationInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirmECC: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("txtProfile");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},
		//

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */
		_checkCookie: function (aControlType) {
			var sStation = this._getCookie("Station");
			var sProfile = this._getCookie("Profile");
			var sAppTrack = this._getCookie("AppTrack");
			this.getModel("local").setProperty("/AppTrackList", aControlType);
			var aSelectEWM = aControlType.filter(function (item) {
				return (item.key === sAppTrack);
			});
			if (aSelectEWM.length > 0) {
				this.getModel("local").setProperty("/AppTrack", aSelectEWM[0].key);
			}
			var sWarehouseNumber = this._getCookie("WarehouseNumber");
			if (sStation === "" || sProfile === "" || !sAppTrack) {
				return;
			}

			this.AppTrack = sAppTrack;
			if (sAppTrack === "ECC") {
				if (!sWarehouseNumber) {
					return;
				}
				this.getRouter().navTo("mainECC", {
					Station: sStation,
					Profile: sProfile
				});
			} else {
				if (!sWarehouseNumber) {
					return;
				}
				this.getRouter().navTo("mainEWM", {
					Station: sStation,
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

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		}
	});
});