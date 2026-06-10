sap.ui.define([
	"com/erpis/shiperp/cancel/hd6/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/cancel/hd6/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/Link",
	"sap/ui/core/MessageType",
	"com/erpis/shiperp/cancel/hd6/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, Sorter, MessageToast, MessageBox, MessagePopover,
	MessagePopoverItem, Link, MessageType, Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.cancel.hd6.controller.Login", {
		/* =========================================================== */
		/* Global variables for this view                              */
		/* =========================================================== */

		//Link to "com.erpis.shiperp.cancel.hd6.model.formatter" for formatter functions
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

			//3. Assign resource bundle
			this.oBundle = this.getResourceBundle();

			// 4. check cookie
			this._checkCookie();
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

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onLoginButtonPressed: function () {
			this.getModel("messageModel").setProperty("/aMessages", []);
			var sStation = this.byId("idShippingStationInp").getValue();
			var sProfile = this.byId("idShippingProfileInp").getValue();
			if (sProfile === "" || sStation === "") {
				MessageBox.error(this.oBundle.getText("errorMissingValueLoginMsg"));
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
					Utils._setCookie("Station", sStation);
					Utils._setCookie("Profile", sProfile);
					this.getRouter().navTo("cancelDetail", {
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

		onShippingStationConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oStationInput = this.byId("idShippingStationInp");
				oStationInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onShippingProfileConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("idShippingProfileInp");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */
		_onObjectMatched: function () {
			this.showBusy();
			this.getModel().read("/GetDefaultUserParam", {
				success: function (oData) {
					this.byId("idShippingStationInp").setValue(oData.GetDefaultUserParam.shippingstation);
					this.byId("idShippingProfileInp").setValue(oData.GetDefaultUserParam.profile);
					this.byId("idShippingProfileInp").focus();
					this.hideBusy();
				}.bind(this)
			});
		},
		_checkCookie: function () {
			var sStation = Utils._getCookie("Station");
			var sProfile = Utils._getCookie("Profile");

			if (sStation === "" || sProfile === "") {
				return;
			}
			this.getRouter().navTo("cancelDetail", {
				ShipStation: sStation,
				Profile: sProfile
			});
		}
	});
});