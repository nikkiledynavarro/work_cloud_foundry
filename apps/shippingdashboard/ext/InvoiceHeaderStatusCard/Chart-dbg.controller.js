(function () {
	"use strict";
	/*global sap, jQuery */
	jQuery.sap.declare("com.erpis.shiperp.shippingdashboard.ext.InvoiceHeaderStatusCard.Chart");
	jQuery.sap.require("jquery.sap.global");
	jQuery.sap.require("sap.ui.core.mvc.Controller");
	jQuery.sap.require("sap.ui.model.json.JSONModel");
	jQuery.sap.require("sap.viz.ui5.format.ChartFormatter");
	jQuery.sap.require("sap.viz.ui5.api.env.Format");
	jQuery.sap.require("sap.ui.model.Filter");
	jQuery.sap.require("sap.ui.model.FilterOperator");
	jQuery.sap.require("com.erpis.shiperp.shippingdashboard.models.formatter");

	/*
	Here you can put Controller code
	*/

	sap.ui.controller("com.erpis.shiperp.shippingdashboard.ext.InvoiceHeaderStatusCard.Chart", {
		// formatter: formatter,
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

			var oLocalData = {
				countStatus: 0
			};
			var oLocalModel = new sap.ui.model.json.JSONModel(oLocalData);
			this.getView().setModel(oLocalModel, "local");

			this.oPopover = this.getView().byId("idPopOver");
			this.oPopover.connect(this.oVizFrame.getVizUid());

			// this.handleChange();
			// 1. get data from backend.
			// 2. set data to UI.
			// var oDateControl = this.byId("idDateTimeHeader");
			// oDateControl.setDateValue(new Date());
			// fire change for date.
			// oDateControl.fireChange();

		},

		onSelectData: function (oEvent) {
			if (!this._oInvoiceStatus) {
				this._oInvoiceStatus = sap.ui.xmlfragment("com.erpis.shiperp.shippingdashboard.ext.InvoiceHeaderStatusCard.InvoiceStatus", this);
				this.getView().addDependent(this._oInvoiceStatus);
			}
			var sSelectedDate = this.byId("idDateTimeHeader").getValue();

			// var oFilter = new sap.ui.model.Filter("CreatedAt", sap.ui.model.FilterOperator.EQ, sSelectedDate);
			var sFAHeaderStatus = oEvent.getParameters("data").data[0].data.FAHeaderStatus;
			var oItemTemplate = sap.ui.xmlfragment("com.erpis.shiperp.shippingdashboard.ext.InvoiceHeaderStatusCard.ColumnListItemTemplate",
				this);
			var oTable = sap.ui.getCore().byId("idTableChartInvoice");
			oTable.bindItems({
				path: "MainModel>/xSERPERPxI_SHDB_INV_STAT",
				parameters: {
					select: "InvoiceNo,Carrier,InvoiceDate,InvoiceDueDate,FAHeaderStatus"
				},
				template: oItemTemplate,
				filters: [new sap.ui.model.Filter("FAHeaderStatus", "EQ", sFAHeaderStatus)],
				sorter: new sap.ui.model.Sorter("InvoiceDueDate", false)
			});
			if (sSelectedDate) {
				oTable.bindItems({
					path: "MainModel>/xSERPERPxI_SHDB_INV_STAT",
					parameters: {
						select: "InvoiceNo,Carrier,InvoiceDate,InvoiceDueDate,FAHeaderStatus"
					},
					template: oItemTemplate,
					filters: [new sap.ui.model.Filter("FAHeaderStatus", "EQ", sFAHeaderStatus), new sap.ui.model.Filter("CreatedAt", sap.ui.model.FilterOperator
						.EQ, sSelectedDate)],
					sorter: new sap.ui.model.Sorter("InvoiceDueDate", false)
				});
			}
			this._oInvoiceStatus.open();
		},

		onCloseNewRule: function () {
			var oDialog = sap.ui.getCore().byId("idDialoForChartInvoice");
			oDialog.close();
		},

		handleNavigation: function (oEvent) {
			var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			var sInvoiceNo = oEvent.getParameter("listItem").getBindingContext("MainModel").getObject().InvoiceNo;
			// var sFAHeaderStatus = oEvent.getParameter("listItem").getBindingContext("MainModel").getObject().FAHeaderStatus;
			var oParam = {
				"InvoiceNo": sInvoiceNo
			};

			var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
				target: {
					semanticObject: "FreightAudit",
					action: "manage"
				},
				params: oParam
			})) || "";
			oCrossAppNavigator.toExternal({
				target: {
					shellHash: hash
				}
			});
		},

		handleChange: function (oEvent) {
			//  handle filter data for selected.
			var sSelectedDate = oEvent.getSource().getValue();
			var oFilter = new sap.ui.model.Filter("CreatedAt", sap.ui.model.FilterOperator.EQ, sSelectedDate);

			//  set dataset for vizframe.
			var oVizFrame = this.getView().byId("idVizFrame");
			var growthRatesDataSet = new sap.viz.ui5.data.FlattenedDataset({
				dimensions: [{
					name: "FAHeaderStatus",
					value: "{MainModel>FAHeaderStatus}"
				}],
				measures: [{
					name: "Total of Status",
					value: "{MainModel>TotalOfHeaderStatus}"
				}],
				data: {
					path: "MainModel>/xSERPERPxI_SHDB_INV_STAT",
					filters: [oFilter]
				}
			});
			oVizFrame.setDataset(growthRatesDataSet);
		},

		onStatusListUpdated: function (oEvent) {
			this.getView().getModel("local").setProperty("/countStatus", oEvent.getParameter("total"));
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