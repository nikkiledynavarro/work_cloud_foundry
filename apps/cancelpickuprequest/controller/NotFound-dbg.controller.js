sap.ui.define([
	"com/erpis/shiperp/hr7/cancelpickuprequest/controller/BaseController",
], function (BaseController) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.hr7.cancelpickuprequest.controller.NotFound", {

		onInit: function () {
			this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
		},

		_onNotFoundDisplayed: function () {
			this.getModel("appView").setProperty("/layout", "OneColumn");
		}
	});
});