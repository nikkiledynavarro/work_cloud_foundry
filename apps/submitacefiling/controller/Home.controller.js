sap.ui.define([
	"com/erpis/shiperp/ACESubmitFiling/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/ACESubmitFiling/model/formatter",
	"sap/m/MessageBox",
	"com/erpis/shiperp/ACESubmitFiling/common/Utils",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Utils, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.submitacefiling.controller.Home", {

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
			// Check cookies
			this._checkCookie();
		},

		_onObjectMatched: function () {
			this.showBusy();
			this.getModel().read("/GetDefaultUserParam", {
				success: function (oData) {
					var sData = oData.GetDefaultUserParam;
					this.byId("txtProfileId").setValue(sData.ProfileId);
					this.byId("txtProfileId").focus();
					if (sData.ProfileId === "") {
						MessageBox.error(this.oBundle.getText("showMessageError"));
						return;
					}
					this.hideBusy();
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* Event handlers                                              */
		/* =========================================================== */
		onLogin: function () {
			var sProfileId = this.byId("txtProfileId").getValue();
			this.getModel("messageModel").setProperty("/aMessages", []);
			if (sProfileId === "") {
				MessageBox.error(this.oBundle.getText("loginValidation"));
				return;
			}
			this.showBusy();
			this.getModel().callFunction("/Login", {
				"method": "GET",
				urlParameters: {
					ProfileId: sProfileId
				},
				success: function () {
					this._setCookie("Profile", sProfileId);
					this.getRouter().navTo("main", {
						ProfileId: sProfileId
					});
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onAceProfileRequested: function () {
			this.oAceProfileDlg = Utils.getFragment("", "AceProfileDialog", this);
			this.oAceProfileDlg.open();
		},

		handleProfileValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("ProfileId", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		handleProfileValueHelpClose: function (oEvent) {
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([]);
		},

		onAceProfileConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oProfileInput = this.byId("txtProfileId");
				oProfileInput.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		/* =========================================================== */
		/* Internal methods                                            */
		/* =========================================================== */
		_checkCookie: function () {
			var sProfile = this._getCookie("ProfileId");
			var sDelivery = this._getCookie("Delivery");
			if (sDelivery !== "") {
				this.getRouter().navTo("main", {
					ProfileId: sProfileId
				});
			}
			if (sProfile === "") {
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