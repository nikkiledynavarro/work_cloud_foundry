sap.ui.define([
	"com/erpis/shiperp/hr7/cancelpickuprequest/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/cancelpickuprequest/model/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.cancelpickuprequest.controller.Main", {

		oBundle: null,
		formatter: formatter,

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			this.setModel(new JSONModel({}), "local");

			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 **/
		_onObjectMatched: function (oEvent) {
			this.hideBusy();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		// Reset button click
		onResetData: function () {
			this.showBusy();
		},

		onCancelPickupRequest: function (oEvent) {
			this.showBusy();
			var oRequestPayload = this.generatePayload();
			this.getModel().create("/CancelPickupRequestQuerySet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessagess(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generatePayload: function () {
			var oPayload = {
				PickupId: this.byId("PickupId").getValue(),
				Remarks: this.byId("RemarkId").getValue(),
				Action: "RequestForPickupCancel",
				Return: []
			};
			return oPayload;
		},

		onNavRequestForPickup: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},
	});
});