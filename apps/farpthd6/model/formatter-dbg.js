sap.ui.define([
], function() {
	"use strict";

	return {

		/**
		 * Rounds the number unit value to 2 digits
		 * @public
		 * @param {string} sValue the number string to be rounded
		 * @returns {string} sValue with 2 digits rounded
		 */

		shiptypeDesc: function(sShiptype) {
			switch (sShiptype) {
				case "01":
					return "Parcel";
				case "02":
					return "LTL";
				case "03":
					return "TL";
				case "04":
					return "LCL";
				case "05":
					return "Air Freight";
				case "06":
					return "FCL";
				case "07":
					return "Rail";
				default:
					return "Other";
			}
		}

	};

});