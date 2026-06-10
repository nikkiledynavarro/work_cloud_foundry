sap.ui.define([
	"com/erpis/shiperp/parceldemo/hd6/controller/BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.parceldemo.hd6.controller.NotFound", {

		/**
		 * Navigates to the worklist when the link is pressed
		 * @public
		 */
		onLinkPressed: function() {
			this.getRouter().navTo("worklist");
		}

	});

});