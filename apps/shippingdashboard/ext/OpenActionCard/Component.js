(function () {
	"use strict";
	/*global jQuery, sap */

	jQuery.sap.declare("com.erpis.shiperp.shippingdashboard.Component");
	jQuery.sap.require("sap.ovp.cards.custom.Component");

	sap.ovp.cards.custom.Component.extend("com.erpis.shiperp.shippingdashboard.ext.OpenActionCard.Component", {
		// use inline declaration instead of component.json to save a round trip
		// Here "Path" denotes a relative path of your fragment/controller from webapp

		metadata: {
			properties: {
				"contentFragment": {
					"type": "string",
					"defaultValue": "com.erpis.shiperp.shippingdashboard.ext.OpenActionCard.Content" // Here you have to put the "Path" to the content fragment you want for your custom card
				}
			},

			version: "@version@",

			library: "sap.ovp",

			includes: [],

			dependencies: {
				libs: [],
				components: []
			},
			config: {},
			customizing: {
				"sap.ui.controllerExtensions": {
					"sap.ovp.cards.generic.Card": {
						controllerName: "com.erpis.shiperp.shippingdashboard.ext.OpenActionCard.Chart" // Here you have to put the "Path" to the controller for your custom card
					}
				}
			}
		}
	});
})();