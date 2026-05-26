sap.ui.define([
	"sap/ui/core/library",
	"com/erpis/shiperp/hr7/carrierperformancereport/controller/BaseController",
	"com/erpis/shiperp/hr7/carrierperformancereport/model/formatter",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/hr7/carrierperformancereport/common/DynamicFilter",
	"com/erpis/shiperp/hr7/carrierperformancereport/common/Utils",
	"sap/m/MessageBox"
], function (library, BaseController, formatter, JSONModel, MessageToast, Fragment, Filter, FilterOperator, DynamicFilter, Utils,
	MessageBox) {
	"use strict";

	var library = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.carrierperformancereport.controller.Main", {

		oBundle: null,
		formatter: formatter,

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			this.setModel(new JSONModel({}), "local");

			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");
			this.onInitCreatedOn(); //set default data for created on
			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 **/
		_onObjectMatched: function (oEvent) {
			this.getModel("local").setProperty("/EnableEmailButton", false);
			this.hideBusy();
		},
		_getSmartTable: function () {
			if (!this._ODOtSmartTable) {
				this._ODOtSmartTable = this.byId("performanceTable");
			}
			return this._ODOtSmartTable;
		},

		onSort: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Sort");
			}
		},

		onFilter: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Filter");
			}
		},

		onGroup: function () {
			MessageToast.show("Not available as this feature is disabled for this app in the view.xml");
		},

		onColumns: function () {
			var oSmartTable = this._getSmartTable();
			if (oSmartTable) {
				oSmartTable.openPersonalisationDialog("Columns");
			}
		},
		onAssignedFiltersChanged: function (oEvent) {
			//handle show/hide filter groups
			if (this.filterCallback === true) {
				// this.onHandleSmartFilterBarVisible(oEvent);
			}
			var oStatusText = sap.ui.getCore().byId(this.getView().getId() + "--statusText");
			var oFilterBar = sap.ui.getCore().byId(this.getView().getId() + "--smartFilterBar");
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		/**
		 * Handle dynamic filter before bind table
		 **/
		onBeforeTableRebind: function (oEvent) {
			var aFilter;
			var oDynamicFilter = this._getControlById("DynamicFilter");
			var aDynamicFilters = DynamicFilter._buildFilterArray(oDynamicFilter, true, this);
			if (aDynamicFilters.length > 0) {
				aFilter = aDynamicFilters.slice(0)[0];
			}
			// Read the count at this stage because all filters from filterbar are now available
			this._readTheFilter(aFilter);
		},

		/**
		 * This method will read data from "/CarrierPerformanceSet" with aFilters for each type of search for
		 * This method is not designed to be re-used.
		 * @param {sap.ui.model.Filter}
		 **/
		_readTheFilter: function (aFilter) {
			this.byId("performanceTable").setBusy(true);
			this.getModel().read("/CarrierPerformanceSet", {
				filters: [aFilter],
				urlParameters: {
					select: "TrackingNumber,MasterTrackingNumber,Carrier,Service,ShippingPoint,CreatedOn,CreatedBy,RequestedDeliveryDate,ActualDeliveryDate,BillingOption,ShipDate,EstimatedArrivalDate,PickupDate,ActualDeliveryTime,DeliveryNumber,GoodsIssueDate,TotalWeight,ShipDays,Plant"
				},
				success: function (oData) {
					this.setModel(new JSONModel(), "data");
					this.getModel("data").setData(oData.results);
					this.getModel("local").setProperty("/EnableEmailButton", true);
					this.byId("performanceTable").setBusy(false);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},
		onNavigationParcelShipmentApp: function (oEvent) {
			var sDeliveryNumber = oEvent.getSource().getBindingContext("data").getObject().DeliveryNumber;
			var shellHash = oEvent.getSource().data("crossNavigate");
			var sProfileDefault = "3000_1/0001/03";
			if (!shellHash) {
				return;
			}

			shellHash += '&/Profile/' + encodeURI(sProfileDefault) + '/' + encodeURIComponent(sDeliveryNumber);

			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		onNavigationTrackShipmentApp: function (oEvent) {
			var sTrackingNumber = oEvent.getSource().getBindingContext("data").getObject().TrackingNumber;
			var shellHash = oEvent.getSource().data("crossNavigate");
			var sProfileDefault = "3000_1/0001";
			if (!shellHash) {
				return;
			}

			shellHash += '&/Profile/' + encodeURI(sProfileDefault) + '/' + encodeURIComponent(sTrackingNumber);

			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		onSubmit: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var aTokens = oMultiInput.getTokens();
			var sNewValue = oMultiInput.getValue();

			if (sNewValue) {
				var oToken = new sap.m.Token({
					key: sNewValue,
					text: sNewValue
				});
				oMultiInput.addToken(oToken);
				oMultiInput.setValue("");
			}
		},

		onMultiInputEmail: function (oEvent) {
			var oMultiInput = oEvent.getSource();
			var aTokens = oMultiInput.getTokens();
			var sNewValue = oMultiInput.getValue();

			if (sNewValue) {
				var oToken = new sap.m.Token({
					key: sNewValue,
					text: sNewValue
				});
				oMultiInput.addToken(oToken);
				oMultiInput.setValue("");
			}
		},

		onExportviaEmail: function (oEvent) {
			//open dialog
			this._sendEmailDialog = Utils.getFragment(null, "Email.SendEmail", this);
			this.byId("idEmailInput").setTokens([]);
			this._sendEmailDialog.open();
		},

		onSelectionChangeCarrier: function (oEvent) {
			var aSelectedKeys = oEvent.getSource().getSelectedKeys();
			// filter Vehicle
			if (aSelectedKeys.length > 0) {
				var aFilters = [];
				for (var i = 0; i < aSelectedKeys.length; i++) {
					var sValue = aSelectedKeys[i];
					if (sValue.length > 0) {
						var oFilter = new sap.ui.model.Filter("Carrier", sap.ui.model.FilterOperator.Contains, sValue);
						aFilters.push(oFilter);
					}
				}
				this.byId("idService").getBinding("items").filter(aFilters);
			} else {
				this.byId("idService").getBinding("items").filter([]);
			}
		},

		onChangeService: function (oEvent) {
			var aSelectedItems = oEvent.getSource().getSelectedItems();
			var aSelectedKeys = aSelectedItems.map(function (item) {
				return item.getBindingContext().getObject().Carrier;
			});
			this.byId("carrierCode").setSelectedKeys(aSelectedKeys);
		},

		onCancel: function () {
			this._sendEmailDialog.close();
		},

		onSendEmail: function () {
			var sEmailAddress = "";
			var aTockens = this.byId("idEmailInput").getTokens();
			var aCarrierPerformanceReport = this.getModel("data").getData();
			if (aTockens.length > 0) {
				for (var i = 0; i < aTockens.length; i++) {
					var sTokenValue = aTockens[i].getText();
					sEmailAddress += sTokenValue + ",";
				}
			} else {
				MessageBox.error(this.oBundle.getText("sendEmailError"));
				return;
			}
			this.showBusy();
			var oRequestPayload = this.generatePayload(aCarrierPerformanceReport, sEmailAddress);
			this.getModel().create("/SendEmailSet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessages(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this._sendEmailDialog.close();
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generatePayload: function (aCarrierPerformanceReport, sEmailAddress) {
			var oPayload = {
				Data: aCarrierPerformanceReport,
				EmailAddress: sEmailAddress,
				Action: "SendEmail",
				Return: []
			};
			return oPayload;
		},

		//end
	});
});