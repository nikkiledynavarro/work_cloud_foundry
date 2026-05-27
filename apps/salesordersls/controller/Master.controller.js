/*global history */
sap.ui.define([
	"com/erpis/shiperp/sls/salesordersls/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"sap/ui/model/Filter",
	"sap/ui/model/Sorter",
	"sap/ui/model/FilterOperator",
	"sap/m/GroupHeaderListItem",
	"sap/ui/Device",
	"com/erpis/shiperp/sls/salesordersls/model/formatter",
	"com/erpis/shiperp/sls/salesordersls/common/Utils",
	"sap/m/MessageBox",
	"sap/base/Log"
], function (BaseController, JSONModel, History, Filter, Sorter, FilterOperator, GroupHeaderListItem, Device, formatter, Utils,
	MessageBox, Log) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.sls.salesordersls.controller.Master", {

		formatter: formatter,
		bLoadInitialFilterOption: true,

		sCustomer: "", // selected customer from list,
		sCreatedBy: "", // selected created user from list,
		sDocument: "", // selected document from list,
		_oDefaultFilterByCust: null,
		_oDefaultFilterByUser: null,
		_oDefaultFilterByDocument: null,
		oBundle: null,
		lastItemSelected: null,
		oLog: null,
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function () {
			this.oLog = Log.getLogger("com.erpis.shiperp.sls.salesordersls.controller.Master");
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			this._oList = this.byId("list");
			// keeps the filter and search state
			this._oListFilterState = {
				aFilter: [],
				aSearch: [],
				aUIFilters: []
			};

			// Control state model
			var oViewModel = this._createViewModel();
			this.setModel(oViewModel, "local");

			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().getRoute("object").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().getRoute("objectDetail").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
		},

		_onMasterMatched: function (oEvent) {
			var sCompleteUrl = window.location.href;
			if (sCompleteUrl.indexOf("?Action=Simulate") >= 0) {
				this.onAddOrder();
			} else {
				if (this.bLoadInitialFilterOption) {
					this.onFilterOptionPress();
					this.oSearchOptDateRangeDlg = Utils.getFragment(null, "SearchOptionDateRangeDialog", this);
					this.oSearchOptDateRangeDlg.open();
					this.bLoadInitialFilterOption = false;
				}
			}

			//Set the layout property of the FCL control to 'OneColumn'
			this.getModel("appView").setProperty("/layout", "OneColumn");

			// Default daterange value
			var oFromDate = new Date();
			// Set it to one month ago
			oFromDate.setMonth(oFromDate.getMonth() - 1);
			this.byId("idMasterDaterange").setDateValue(oFromDate);
			this.byId("idMasterDaterange").setSecondDateValue(new Date());

			//Default daterange value in selectoption dialog
			this.byId("idMasterDaterangeSelectOptionDialog").setDateValue(oFromDate);
			this.byId("idMasterDaterangeSelectOptionDialog").setSecondDateValue(new Date());

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * After list data is available, this handler method updates the
		 * master list counter
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {
			// update the master list object counter after new data is loaded
			this._updateListItemCount(oEvent.getParameter("total"));
		},

		/**
		 * Event handler for the master search field. Applies current
		 * filter value and triggers a new search. If the search field's
		 * 'refresh' button has been pressed, no new search is triggered
		 * and the list binding is refresh instead.
		 * @param {sap.ui.base.Event} oEvent the search event
		 * @public
		 */
		onSearch: function (oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
				return;
			}

			var sQuery = oEvent.getParameter("query");
			this.SaleNoSearch = sQuery;

			if (sQuery) {
				this._oListFilterState.aSearch = [
					new Filter([
						new Filter("SalesNo", FilterOperator.Contains, sQuery),
						new Filter("CustomerReference", FilterOperator.Contains, sQuery)
					], false)
				];
			} else {
				this._oListFilterState.aSearch = [];
			}

			// this.onMasterFilterChange();//changed to UI search by Tim 16/9/2021
			this._applyUISearch(); //added by Tim 16/9/2021
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			this._oList.getBinding("items").refresh();
		},

		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange: function (oEvent) {
			var oList = oEvent.getSource(),
				bSelected = oEvent.getParameter("selected");
			var oSelectedItem = oEvent.getParameter("listItem") || oEvent.getSource();
			var sPath = oEvent.getParameter("listItem").getBindingContextPath();
			var oSelectedObject = oSelectedItem.getBindingContext("local").getObject();
			var sSalesNo = this.getModel("local").getProperty(sPath).SalesNo;
			if (this.lastItemSelected === null) {
				this.lastItemSelected = oSelectedItem;
			}
			// skip navigation when deselecting an item in multi selection mode
			if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
				// get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
				if (this._isUserChangeValue()) {
					var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
					var sMsg = this.oBundle.getText("leaveWithoutSaveMsg");
					MessageBox.warning(
						sMsg, {
							actions: [this.oBundle.getText("leaveBtn"), sap.m.MessageBox.Action.CANCEL],
							styleClass: bCompact ? "sapUiSizeCompact" : "",
							initialFocus: sap.m.MessageBox.Action.CANCEL,
							onClose: function (sAction) {
								if (sAction === this.oBundle.getText("leaveBtn")) {
									this._showDetail(sSalesNo);
									this.lastItemSelected = oSelectedItem;
								} else {
									oList.setSelectedItem(this.lastItemSelected);
									return;
								}
							}.bind(this)
						}
					);
				} else {
					this._showDetail(sSalesNo, oSelectedObject);
					this.lastItemSelected = oSelectedItem;
				}
			}
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the master list, that selection is removed.
		 * @public
		 */
		onBypassed: function () {
			this._oList.removeSelections(true);
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will navigate to the shell home
		 * @public
		 */
		onNavBack: function () {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
		},

		onMasterFilterChange: function () {
			var oDateRange = this.byId("idMasterDaterange");

			var oDeliveryStatus = this.byId("idMasterDocStatus");
			var oDocType = this.byId("idMasterDocType");
			//removed soldto, shipto by Tim 15/9/2021
			var sDeliveryStatus = oDeliveryStatus.getSelectedKey();
			var sDocType = oDocType.getSelectedKey();

			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var sDateFrom = oDateFormat.format(oDateRange.getDateValue());
			var sDateTo = oDateFormat.format(oDateRange.getSecondDateValue());

			//Axo 4852 Added by Tim 21/12/2021
			this.setMasterCreatedOnData(sDateFrom, sDateTo);

			var aContainerFilter = [];

			if (this.getModel("local").getProperty("/SearchOption") === 0) {
				aContainerFilter.push(this._oDefaultFilterByCust);
			} else if (this.getModel("local").getProperty("/SearchOption") === 1) {
				aContainerFilter.push(this._oDefaultFilterByUser);
			} else if (this.getModel("local").getProperty("/SearchOption") === 2) {
				aContainerFilter.push(this._oDefaultFilterByDocument);
			}

			if (sDeliveryStatus !== "") {
				aContainerFilter.push(new Filter("DeliveryStatus", sap.ui.model.FilterOperator.EQ, sDeliveryStatus));
			}
			if (sDocType !== "") {
				aContainerFilter.push(new Filter("DocType", sap.ui.model.FilterOperator.EQ, sDocType));
			}
			if (sDateFrom && sDateTo) {
				aContainerFilter.push(new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo));
			}
			//Tim removed soldto,shipto move to UI search

			var oAllFilter = new Filter(aContainerFilter, true);
			this._oListFilterState.aFilter = [oAllFilter];

			//Tim added 15/9/2021
			//Backend search
			this._applyFilterSearch();
		},

		onFilterOptionPress: function () {
			this.oCustomListDlg = Utils.getFragment(null, "SearchOptionDialog", this);
			this.byId("customerTable").getBinding("rows").filter([]);
			this.byId("userTable").getBinding("rows").filter([]);
			// this.byId("documentTable").getBinding("rows").filter([]);
			this.getModel("local").setProperty("/SalesOrderListSet", "");
			this.byId("customerSearch").setValue("");
			this.byId("userSearch").setValue("");
			this.byId("documentSearch").setValue("");
			this.oCustomListDlg.open();
			this.oSearchOptDateRangeDlg = Utils.getFragment(null, "SearchOptionDateRangeDialog", this);
			this.oSearchOptDateRangeDlg.open();
			// sap.ui.getView().byId("idInputDateRangeSearchOptDlg").setDateValue("");
			// sap.ui.getView().byId("idInputDateRangeSearchOptDlg").setSecondDateValue("");
		},

		onFilterOptionClose: function (oEvent) {
			this.byId("customerTable").getBinding("rows").filter([]);
			this.byId("userTable").getBinding("rows").filter([]);
			// this.byId("documentTable").getBinding("rows").filter([]);
			this.getModel("local").setProperty("/SalesOrderListSet", "");
			this.byId("customerSearch").setValue("");
			this.byId("userSearch").setValue("");
			this.byId("documentSearch").setValue("");
			this.oCustomListDlg.close();
			this.getModel("appView").setProperty("/layout", "OneColumn");
		},

		onCustomerConfirm: function (oEvent) {
			if (oEvent.getParameter("rowContext")) {
				var oDeferred = $.Deferred();
				var oTable = oEvent.getSource();
				var aSelectedIndices = oTable.getSelectedIndices();
				var oData = oEvent.getParameter("rowContext").getObject();

				var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				var sDateFrom = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getDateValue());
				var sDateTo = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue());
				//(+) 4852 Added by Tim 21/12/2021
				this.setMasterCreatedOnData(sDateFrom, sDateTo);

				//Default Del status for OpenSO quick links
				var sCompleteUrl = window.location.href;

				if (aSelectedIndices.length !== 1) {
					return;
				}
				this.sCustomer = oData.Customer;
				this.getModel("local").setProperty("/selectedCustomer", oData);

				// Prepare default filter based on selected customer (excluding the fields on master view)
				this._oDefaultFilterByCust = new Filter([
					// new Filter([
					// 	new Filter("ShipToParty", sap.ui.model.FilterOperator.EQ, this.sCustomer),
					// 	new Filter("SoldToParty", sap.ui.model.FilterOperator.EQ, this.sCustomer)
					// ], false),
					new Filter("Customer", sap.ui.model.FilterOperator.EQ, oData.Customer),
					new Filter("SalesOrg", sap.ui.model.FilterOperator.EQ, oData.SalesOrg),
					new Filter("DistrChannel", sap.ui.model.FilterOperator.EQ, oData.DistChannel),
					new Filter("Division", sap.ui.model.FilterOperator.EQ, oData.Division)
				], true);

				var aArray = [
					this._oDefaultFilterByCust,
					new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo)
				];
				var aArrayCreatedOn = [new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo)];
				if (sCompleteUrl.indexOf("?Action=Open") >= 0) {
					aArray.push(new Filter("DeliveryStatus", sap.ui.model.FilterOperator.EQ, "A"));
					this.byId("idMasterDocStatus").setSelectedKey("A");
				}
				if (aArrayCreatedOn[0].oValue1 && aArrayCreatedOn[0].oValue1) {
					var sPath = "/SalesOrderListSet";
					this.showBusy();
					this.getModel().read(sPath, {
						filters: aArray,
						success: function (oSalesOrders) {
							if (oSalesOrders.results.length !== 0) {
								this.getModel("local").setProperty("/SalesOrderListSet", oSalesOrders.results);
								//(+) 4852 Added by Tim 21/12/2021
								var sMasterDateFrom = this.byId("idMasterDaterangeSelectOptionDialog").getDateValue();
								var sMasterDateTo = this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue();
								this.byId("idMasterDaterange").setDateValue(sMasterDateFrom);
								this.byId("idMasterDaterange").setSecondDateValue(sMasterDateTo);

								this.setMasterCreatedOnData(sMasterDateFrom, sMasterDateTo);
								oDeferred.resolve();
							}
							this.hideBusy();
						}.bind(this),
						error: function (oError) {
							this._handleODataError(oError);
							this.hideBusy();
						}.bind(this)
					});
					$.when(oDeferred).done(function () {
						var oBindingInfo = {
							path: "local>/SalesOrderListSet",
							// parameters: {
							// 	expand: "to_soldTo,to_shipTo,to_deliBlock"
							// },
							template: Utils.getFragment(null, "MasterListTemplate", this),
							// filters: aArray,
							sorter: [
								new sap.ui.model.Sorter("SalesNo", true)
							]
						};
						this._oList.bindItems(oBindingInfo);

						this.getModel("local").setProperty("/SearchOption", 0);
						this._refreshMasterPageControl("Customer");

						this.oCustomListDlg.close();
						this.getModel("appView").setProperty("/layout", "OneColumn");

						this.hideBusy();
					}.bind(this));
				} else {
					MessageBox.warning("Enter CreatedOn before searching");
					return;
				}

			}
		},

		onCustomerSearch: function (oEvent) {
			var oTable = this.byId("customerTable");
			var sValue = oEvent.getParameter("newValue");
			var oAllFilter = new Filter([
				new Filter("Customer", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Name1", sap.ui.model.FilterOperator.Contains, sValue)
			], false);

			var oBinding = oTable.getBinding("rows");
			oBinding.filter([oAllFilter]);
		},

		onUserConfirm: function (oEvent) {
			if (oEvent.getParameter("rowContext")) {
				var oDeferred = $.Deferred();
				var oTable = oEvent.getSource();
				var aSelectedIndices = oTable.getSelectedIndices();
				var oData = oEvent.getParameter("rowContext").getObject();

				var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				var sDateFrom = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getDateValue());
				var sDateTo = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue());
				var sCompleteUrl = window.location.href;

				if (aSelectedIndices.length !== 1) {
					return;
				}
				this.sUser = oData.Username;
				this.getModel("local").setProperty("/selectedCreatedBy", oData);

				// Prepare default filter based on selected User (excluding the fields on master view)
				this._oDefaultFilterByUser = new Filter([
					new Filter("CreatedBy", sap.ui.model.FilterOperator.EQ, this.sUser)
				], true);

				var aArrayCreatedOn = [new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo)];

				var aArray = [
					this._oDefaultFilterByUser,
					new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo)
				];
				if (sCompleteUrl.indexOf("?Action=Open") >= 0) {
					aArray.push(new Filter("DeliveryStatus", sap.ui.model.FilterOperator.EQ, "A"));
					this.byId("idMasterDocStatus").setSelectedKey("A");
				}
				if (aArrayCreatedOn[0].oValue1 && aArrayCreatedOn[0].oValue1) {
					var sPath = "/SalesOrderListSet";
					this.showBusy();
					this.getModel().read(sPath, {
						filters: aArray,
						success: function (oSalesOrders) {
							if (oSalesOrders.results.length !== 0) {
								this.getModel("local").setProperty("/SalesOrderListSet", oSalesOrders.results);
								this.byId("idMasterDaterange").setDateValue(this.byId("idMasterDaterangeSelectOptionDialog").getDateValue());
								this.byId("idMasterDaterange").setSecondDateValue(this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue());
								oDeferred.resolve();
							}
							this.hideBusy();
						}.bind(this),
						error: function (oError) {
							this._handleODataError(oError);
							this.hideBusy();
						}.bind(this)
					});
					$.when(oDeferred).done(function () {
						var oBindingInfo = {
							path: "local>/SalesOrderListSet",
							// parameters: {
							// 	expand: "to_soldTo,to_shipTo,to_deliBlock"
							// },
							template: Utils.getFragment(null, "MasterListTemplate", this),
							// filters: aArray,
							sorter: [
								new sap.ui.model.Sorter("CreatedBy", true)
							]
						};
						this._oList.bindItems(oBindingInfo);

						this.getModel("local").setProperty("/SearchOption", 1);
						this._refreshMasterPageControl("CreatedBy");

						this.oCustomListDlg.close();
						this.getModel("appView").setProperty("/layout", "OneColumn");

						this.hideBusy();
					}.bind(this));
				} else {
					MessageBox.warning("Enter CreatedOn before searching");
					return;
				}

			}
		},

		onUserSearch: function (oEvent) {
			var oTable = this.byId("userTable");
			var sValue = oEvent.getParameter("newValue");
			var oAllFilter = new Filter([
				new Filter("Username", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Name", sap.ui.model.FilterOperator.Contains, sValue)
			], false);

			var oBinding = oTable.getBinding("rows");
			oBinding.filter([oAllFilter]);
		},

		onDocumentConfirm: function (oEvent) {
			if (oEvent.getParameter("rowContext")) {
				var oTable = oEvent.getSource();
				var aSelectedIndices = oTable.getSelectedIndices();
				var oData = oEvent.getParameter("rowContext").getObject();

				if (aSelectedIndices.length !== 1) {
					return;
				}
				this.sDocument = oData.SalesNo;
				this.getModel("local").setProperty("/selectedDocument", oData);

				// Prepare default filter based on selected Document (excluding the fields on master view)
				this._oDefaultFilterByDocument = new Filter([
					new Filter("SalesNo", sap.ui.model.FilterOperator.EQ, this.sDocument)
				], true);

				var oBindingInfo = {
					path: "local>/SalesOrderListSet",
					// parameters: {
					// 	expand: "to_soldTo,to_shipTo,to_deliBlock"
					// },
					template: Utils.getFragment(null, "MasterListTemplate", this),
					// filters: [
					// 	this._oDefaultFilterByDocument
					// ],
					sorter: [
						new sap.ui.model.Sorter("SalesNo", true)
					]
				};
				this._oList.bindItems(oBindingInfo);

				this.getModel("local").setProperty("/SearchOption", 2);
				this._refreshMasterPageControl("Document");

				this.oCustomListDlg.close();
				this._showDetail(this.sDocument, oData);
			}
		},

		onDocumentSearch: function (oEvent) {
			// var oTable = this.byId("documentTable");
			// var sValue = oEvent.getParameter("newValue");
			var sValue = oEvent.getSource().getValue();
			// var oAllFilter = new Filter([
			// 	new Filter("SalesNo", sap.ui.model.FilterOperator.Contains, sValue)
			// ], false);
			// var oBinding = oTable.getBinding("rows");
			// oBinding.filter([oAllFilter]);
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var sDateFrom = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getDateValue());
			var sDateTo = oDateFormat.format(this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue());
			var aArrayCreatedOn = [new Filter("CreatedOn", sap.ui.model.FilterOperator.BT, sDateFrom, sDateTo)];
			if (aArrayCreatedOn[0].oValue1 && aArrayCreatedOn[0].oValue1) {
				var sPath = "/SalesOrderListSet";
				this.showBusy();
				this.getModel().read(sPath, {
					filters: [
						new Filter("SalesNo", "EQ", sValue)
					],
					success: function (oData) {
						if (oData.results.length !== 0) {
							this.getModel("local").setProperty("/SalesOrderListSet", oData.results);
							this.byId("idMasterDaterange").setDateValue(this.byId("idMasterDaterangeSelectOptionDialog").getDateValue());
							this.byId("idMasterDaterange").setSecondDateValue(this.byId("idMasterDaterangeSelectOptionDialog").getSecondDateValue());
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				MessageBox.warning("Enter CreatedOn before searching");
				return;
			}

		},

		onAddOrder: function () {
			this.oSalesAreaDialog = Utils.getFragment(null, "SelectSalesAreaDialog", this);
			this.byId("salesAreaTable").getBinding("rows").filter([]);
			this.byId("salesAreaTable").clearSelection();
			this.byId("salesAreaSearch").setValue("");
			this.oSalesAreaDialog.open();
		},

		onNavigateToCreateSO: function () {
			this.oCustomListDlg.close();

			this.oSalesAreaDialog = Utils.getFragment(null, "SelectSalesAreaDialog", this);
			this.byId("salesAreaTable").getBinding("rows").filter([]);
			this.byId("salesAreaSearch").setValue("");
			this.oSalesAreaDialog.open();
		},

		onSalesAreaConfirm: function (oEvent) {
			var oObject = oEvent.getParameter("rowContext").getObject();

			this.byId("salesAreaTable").clearSelection();
			this.byId("salesAreaSearch").setValue("");

			// Set the layout property of the FCL control to 'OneColumn'
			this.getModel("appView").setProperty("/layout", "OneColumn");
			this.getRouter().navTo("createSO", {
				SalesDocType: oObject.SalesDocType,
				SalesOrg: oObject.SalesOrg,
				DistChannel: oObject.DistChannel,
				Division: oObject.Division
			});
		},

		onSalesOrderTypeSearch: function (oEvent) {
			var oTable = this.byId("salesAreaTable");
			var sValue = oEvent.getParameter("newValue");
			var oAllFilter = new Filter([
				new Filter("SalesDocType", sap.ui.model.FilterOperator.EQ, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			], false);

			var oBinding = oTable.getBinding("rows");
			oBinding.filter([oAllFilter]);
		},

		onSalesAreaClose: function () {
			this.oSalesAreaDialog.close();
		},

		_formatDateObject: function (sDate) {
			var year = sDate.substring(0, 4);
			var month = sDate.substring(4, 6);
			var day = sDate.substring(6, 8);
			sDate = year + '-' + month + '-' + day;
			return sDate;
		},

		onFillInputDateRangeSearchOptDlg: function () {
			var sDateFrom = this.byId("idInputDateRangeSearchOptDlg").getDateValue();
			var sDateTo = this.byId("idInputDateRangeSearchOptDlg").getSecondDateValue();

			if (!sDateFrom && !sDateTo) {
				MessageBox.warning("Please Fill DateRange before seaching");
			} else {
				// Set new DateRange for DateRange in SelectOptionDialog
				this.byId("idMasterDaterangeSelectOptionDialog").setDateValue(sDateFrom);
				this.byId("idMasterDaterangeSelectOptionDialog").setSecondDateValue(sDateTo);
				this.oSearchOptDateRangeDlg.close();
			}
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */
		_refreshMasterPageControl: function (sSearchOption) {
			var sCompleteUrl = window.location.href;
			if (sCompleteUrl.indexOf("?Action=Open") === -1) {
				this.byId("idMasterDocStatus").setSelectedKey(null);
			}
			var oDocType = this.byId("idMasterDocType");
			// <core:ListItem key="{SalesDocType}" text="{Description}" additionalText="{SalesDocType}"/>
			oDocType.bindItems({
				path: "/xSERPERPxI_AUART",
				template: new sap.ui.core.ListItem({
					key: "{SalesDocType}",
					text: "{Description}",
					additionalText: "{SalesDocType}"
				})
			});
			oDocType.setSelectedKey(null);
			if (sSearchOption === "Customer") {
				// Set visibility of controls based on Selected Search Option
				this.byId("idMasterCreatedOnLayout").setVisible(true);
				this.byId("idMasterDocStatusLayout").setVisible(true);
				this.byId("searchToolbar").setVisible(true);

				this.byId("idMasterDocTypeLayout").setVisible(true);
				var oData = this.getModel("local").getProperty("/selectedCustomer");
				this.byId("idMasterDocType").getBinding("items").filter([
					new Filter("SalesOrg", "EQ", oData.SalesOrg),
					new Filter("DistChannel", "EQ", oData.DistChannel),
					new Filter("Division", "EQ", oData.Division)
				]);

				this.byId("idMasterSoldto").setVisible(true);
				this.byId("idMasterSoldto").setPressed(false);

				this.byId("idMasterShipto").setVisible(true);
				this.byId("idMasterShipto").setPressed(false);
			} else {
				oDocType.bindItems({
					path: "/SalesOrderTypeSet",
					template: new sap.ui.core.ListItem({
						key: "{SalesDocType}",
						text: "{Description}",
						additionalText: "{SalesDocType}"
					})
				});
				if (sSearchOption === "Document") {
					this.byId("idMasterCreatedOnLayout").setVisible(false);
					this.byId("idMasterDocStatusLayout").setVisible(false);
					this.byId("searchToolbar").setVisible(false);
				} else {
					this.byId("idMasterCreatedOnLayout").setVisible(true);
					this.byId("idMasterDocStatusLayout").setVisible(true);
					this.byId("searchToolbar").setVisible(true);
				}

				// Set visibility of controls based on Selected Search Option
				this.byId("idMasterDocTypeLayout").setVisible(true);

				this.byId("idMasterSoldto").setVisible(false);
				this.byId("idMasterSoldto").setPressed(false);

				this.byId("idMasterShipto").setVisible(false);
				this.byId("idMasterShipto").setPressed(false);
			}
		},

		_createViewModel: function () {
			return new JSONModel({
				SearchOption: -1,
				title: this.oBundle.getText("masterTitleCount", [0]),
				noDataText: this.oBundle.getText("masterListNoDataText"),
				selectedCustomer: {
					Name1: "Not Available"
				}
			});
		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function (sSalesNo, oSelectedObject) {
			var bReplace = !Device.system.phone;
			// reset global data
			this.getModel("global").setProperty("/StorePackingProposal", null);
			this.getModel("global").setProperty("/SalesOrderDetail", oSelectedObject);

			// set the layout property of FCL control to show two columns
			this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");

			this.getRouter().navTo("object", {
				SalesNo: sSalesNo
			}, bReplace);

		},

		_isUserChangeValue: function () {
			var bUserChange = false;
			var oShipSetSet1 = this.getModel("global").getProperty("/ShipSetSetOriginal");
			var oShipSetSet2 = this.getModel("global").getProperty("/ShipSetSet");
			var bAreTheSame = true;
			if (!oShipSetSet1) {
				return bUserChange; // first time navigate to detail.
			}
			for (var i = 0; i < oShipSetSet1.length; i++) {
				bAreTheSame = this._compareObjects(oShipSetSet1[i], oShipSetSet2[i]);
				if (!bAreTheSame) {
					bUserChange = true;
					break;
				}
			}
			return bUserChange;
		},

		_compareObjects: function (x, y) {
			var objectsAreSame = true;
			for (var propertyName in x) {
				if (x.hasOwnProperty(propertyName)) {
					if (typeof (x[propertyName]) === "object") {
						objectsAreSame = this._compareObjects(x[propertyName], y[propertyName]);
					} else {
						try {
							if (x[propertyName] !== y[propertyName]) {
								objectsAreSame = false;
							}
						} catch (exc) {
							this.oLog.error(exc);
						}
					}
					if (objectsAreSame === false) {
						break;
					}
				}

			}
			return objectsAreSame;
		},

		/**
		 * Sets the item count on the master list header
		 * @param {integer} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount: function (iTotalItems) {
			var sTitle;
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {
				sTitle = this.oBundle.getText("masterTitleCount", [iTotalItems]);
				this.getModel("local").setProperty("/title", sTitle);
			}
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyFilterSearch: function () {
			var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
				oViewModel = this.getModel("local");
			var aFilters1 = [new Filter(aFilters, true)];
			this.getMasterListsData(aFilters1);

			//changed by Tim 15/9/2021
			// var oMasterListBindingItems = this._oList.getBinding("items");
			// oMasterListBindingItems.filter(aFilters1);//before (aFilters1, "Application")
			// oMasterListBindingItems.refresh();
			// changes the noDataText of the list in case there are no filter results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.oBundle.getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.oBundle.getText("masterListNoDataText"));
			}
		},
		//For search by soldto, shipto UI search added by Tim 15/9/2021
		onHandleMasterUISearch: function () {
			this._oListFilterState.aUIFilters = [];
			var oSoldto = this.byId("idMasterSoldto");
			var oShipto = this.byId("idMasterShipto");
			var bSoldto = oSoldto.getPressed();
			var bShipto = oShipto.getPressed();
			if (bSoldto) {
				this._oListFilterState.aUIFilters.push(new Filter("SoldToParty/toParty", sap.ui.model.FilterOperator.EQ, this.sCustomer));
			}
			if (bShipto) {
				this._oListFilterState.aUIFilters.push(new Filter("ShipToParty/toParty", sap.ui.model.FilterOperator.EQ, this.sCustomer));
			}
			this._applyUISearch();
		},
		_applyUISearch: function () {
			var aFilters = this._oListFilterState.aUIFilters.concat(this._oListFilterState.aSearch);
			var aFilters1 = [new Filter(aFilters, true)];
			var oMasterListBindingItems = this._oList.getBinding("items");
			oMasterListBindingItems.filter(aFilters1);
			oMasterListBindingItems.refresh();
		},
		//For search both of filters backend search added by Tim 15/9/2021
		getMasterListsData: function (aArray) {
			var oDeferred = $.Deferred();
			var sPath = "/SalesOrderListSet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: aArray,
				success: function (oSalesOrders) {
					if (oSalesOrders.results.length !== 0) {
						oDeferred.resolve(oSalesOrders.results);
					} else {
						oDeferred.resolve([]);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
			$.when(oDeferred).done(function (aSalesOrders) {
				this.getModel("local").setProperty("/SalesOrderListSet", aSalesOrders);
				this.hideBusy();
			}.bind(this));

		}, //

	});

});