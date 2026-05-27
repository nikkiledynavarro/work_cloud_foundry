(function () {
	"use strict";
	/*global sap, jQuery */
	jQuery.sap.declare("com.erpis.shiperp.shippingdashboard.ext.TrackingShipmentCard.Chart");
	jQuery.sap.require("jquery.sap.global");
	jQuery.sap.require("sap.ui.core.mvc.Controller");
	jQuery.sap.require("sap.ui.model.json.JSONModel");
	jQuery.sap.require("sap.viz.ui5.format.ChartFormatter");
	jQuery.sap.require("sap.viz.ui5.api.env.Format");
	jQuery.sap.require("sap.ui.model.Filter");
	jQuery.sap.require("sap.ui.model.FilterOperator");
	/*
	Here you can put Controller code
	*/

	sap.ui.controller("com.erpis.shiperp.shippingdashboard.ext.TrackingShipmentCard.Chart", {

		onInit: function () {
			var oData = {
				selections: [{
					key: "percent",
					text: "Percentage"
				}, {
					key: "value",
					text: "Value"
				}]
			};
			var oSelect = this.getView().byId("idSelect");
			this.oVizFrame = this.getView().byId("idVizFrame");
			this.oVizFrame.setVizProperties({
				title: {
					visible: false
				},
				legend: {
					visible: true,
					isScrollable: false
				},
				plotArea: {
					dataLabel: {
						visible: true
					}
				},
				interaction: {
					selectability: {
						mode: "exclusive"
					}
				}
			});
			var dataModel = new sap.ui.model.json.JSONModel(oData);
			oSelect.setModel(dataModel, "Dropdown");
			this.oPopover = this.getView().byId("idPopOver");
			this.oPopover.connect(this.oVizFrame.getVizUid());

		},

		onSelectData: function (oEvent) {
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("com.erpis.shiperp.shippingdashboard.ext.TrackingShipmentCard.Popover", this);
				this.getView().addDependent(this._oPopover);
			}
			var sCarrier = oEvent.getParameters("data").data[0].data.Carrier;
			var oItemTemplate = sap.ui.xmlfragment("com.erpis.shiperp.shippingdashboard.ext.TrackingShipmentCard.ColumnListItemTemplate", this);
			var oTable = sap.ui.getCore().byId("idDialoForChart");
			oTable.bindItems({
				path: "MainModel>/xSERPERPxI_SHDB_CUBE_TRACKSHIP",
				parameters: {
					select: "TrackNo,Status,TrackDate"
				},
				template: oItemTemplate,
				filters: [new sap.ui.model.Filter("Carrier", "EQ", sCarrier)]
			});
			this._oPopover.open();
		},

		handleSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("TrackNo", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},
		handleNavigation: function (oEvent) {
			var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			var sTrackNo = oEvent.getParameter("selectedItem").getBindingContext("MainModel").getObject().TrackNo;
			var oParam = {
				"trackno": sTrackNo
			};

			var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
				target: {
					semanticObject: "TrackShipment",
					action: "track"
				},
				params: oParam
			})) || "";
			oCrossAppNavigator.toExternal({
				target: {
					shellHash: hash
				}
			});
		},

		onSelectionChange: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedItem().getKey();
			if (sSelectedKey === "value") {
				this.oVizFrame.setVizProperties({
					plotArea: {
						dataLabel: {
							type: "value"
						}
					}
				});
			} else {
				if (sSelectedKey === "percent") {
					this.oVizFrame.setVizProperties({
						plotArea: {
							dataLabel: {
								type: "percentage"
							}
						}
					});
				}
			}
		},

		formatDateString: function (sDateString) {
			//To be same with ABAP datum data type, sDateString should have format YYYYMMDD
			if (!sDateString || sDateString.length !== 8 || sDateString === "00000000") {
				return "";
			} else {
				var sYear = sDateString.substring(0, 4);
				var sMonth = sDateString.substring(4, 6);
				var sDate = sDateString.substring(6, 8);
				return sMonth + "/" + sDate + "/" + sYear;
			}
		}
	});
})();