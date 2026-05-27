(function () {
	"use strict";
	/*global sap, jQuery */

	/**
	 * @fileOverview Application component to display information on entities from the GWSAMPLE_BASIC
	 *   OData service.
	 * @version @version@
	 */
	jQuery.sap.declare("com.erpis.shiperp.sls.shippingdashboardsls.Component");

	jQuery.sap.require("sap.ovp.app.Component");

	sap.ovp.app.Component.extend("com.erpis.shiperp.sls.shippingdashboardsls.Component", {
		metadata: {
			manifest: "json"
		}
	});
}());