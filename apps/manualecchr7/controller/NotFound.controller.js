sap.ui.define([
	"com/erpis/shiperp/manualecc/hr7/controller/BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.manualecc.hr7.controller.NotFound", {

		/**
		 * Navigates to the worklist when the link is pressed
		 * @public
		 */
		onLinkPressed: function() {
			this.getRouter().navTo("worklist");
		}

	});

});