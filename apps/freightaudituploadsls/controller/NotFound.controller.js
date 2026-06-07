sap.ui.define([
	"com/erpis/shiperp/freightauditupload/controller/BaseController",
], function (BaseController) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightauditupload.controller.NotFound", {

		onInit: function () {
			this.getRouter().getTarget("notFound").attachDisplay(this._onNotFoundDisplayed, this);
		},

		_onNotFoundDisplayed: function () {
			this.getModel("appView").setProperty("/layout", "OneColumn");
		}
	});
});