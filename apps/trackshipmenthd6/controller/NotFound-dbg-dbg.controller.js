sap.ui.define([
		"com/erpis/shiperp/trackshipment/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("com.erpis.shiperp.trackshipment.hd6.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);