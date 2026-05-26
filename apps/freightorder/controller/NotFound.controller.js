sap.ui.define([
	"com/erpis/shiperp/freightorder/controller/BaseController"
], function (BaseController) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightorder.controller.NotFound", {

		/**
		 * Navigates to the worklist when the link is pressed
		 * @public
		 */
		onLinkPressed: function () {
			this.showBusy();
			this.getRouter().navTo("freightUnit");
		}

	});

});