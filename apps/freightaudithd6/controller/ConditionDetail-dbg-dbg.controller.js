/*global location*/
sap.ui.define([
	"com/erpis/shiperp/freightaudit/hd6/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/freightaudit/hd6/model/formatter",
	"sap/ui/model/Filter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/FilterOperator",
	"com/erpis/shiperp/freightaudit/hd6/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, MessageToast, MessageBox, FilterOperator, Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightaudit.hd6.controller.ConditionDetail", {

		formatter: formatter,
		oBundle: null, // i18n bundle class
		// Commonly used header properties
		sVendor: "",
		sInvoiceNo: "",
		sTrackingNo: "",
		sCarrier: "",
		sAccountNo: "",

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.oDeferredCarier = $.Deferred();
			this.oDeferredShip = $.Deferred();

			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				countApproved: 0,
				countOpen: 0,
				countDisputed: 0,
				countReleased: 0
			});
			this.setModel(oViewModel, "local");

			this.getRouter().getRoute("conditionDetail").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");
		},

		onAfterRendering: function () {
			// Applied to fix overlap footer css issue (This issue is fixed when upgrade to 1.44 or above)
			this.checkSapUi5Version(this.byId("sfFreight"));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();

			this.sVendor = oEvent.getParameter("arguments").Vendor;
			this.sInvoiceNo = oEvent.getParameter("arguments").InvoiceNo;
			this.sAccountNo = oEvent.getParameter("arguments").AccountNo;
			this.sCompanyCode = oEvent.getParameter("arguments").CompanyCode;
			this.sTrackingNo = oEvent.getParameter("arguments").TrackingNo;
			this.sCarrier = oEvent.getParameter("arguments").Carrier;
			this.sFilterKey = oEvent.getParameter("arguments").filterKey;

			this.getModel().metadataLoaded().then(function () {
				this.loadPageData(this.sVendor, this.sInvoiceNo, this.sTrackingNo);
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onShipERPUpdateFinished: function () {
			this.oDeferredShip.resolve();
		},

		onCarrierUpdateFinished: function () {
			this.oDeferredCarier.resolve();
		},

		/**
		 * Called when button Clear Message is clicked.
		 * @public
		 */
		onClearMessages: function () {
			this._clearMessages(this, "local");
		},

		/**
		 * Called when button Approve is clicked.
		 * @public
		 */
		onApprovePress: function () {
			var sMsg = this.oBundle.getText("confirmSetStatusOneDtlMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._updateStatus("A", this.getView().getBindingContext().getObject().ChangedDateTime);
					}
				}.bind(this)
			});
		},

		onDisputeListDialogSelect: function () {
			this.showBusy();
			var oItems = sap.ui.getCore().byId(this.getView().createId("tbDisputeList")).getSelectedItems();
			var sPath = oItems[0].getBindingContextPath();
			var sDisputeID = this.getModel("local").getProperty(sPath).DisputeID;

			this.getModel().callFunction("/DisputeItem", {
				method: "POST",
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: this.sTrackingNo,
					DisputeID: sDisputeID
				},
				groupId: "FAMassCreateDispute",
				changeSetId: "dispute"
			});
			this.getModel().submitChanges({
				groupId: "FAMassCreateDispute",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("msbCreateDipsuteTitleSucess"));
					}
					this._refreshHeaderAndItems();
					this.hideBusy();
					this.oDisputeListDialog.close();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		onDisputeListDialogClose: function () {
			this.oDisputeListDialog.close();
		},

		onDisputeListSearch: function (oEvent) {
			var sValue = oEvent.getSource().getValue("value");
			var oFilter = new Filter("DisputeID", sap.ui.model.FilterOperator.Contains, sValue);
			var oView = this.getView();
			var oBinding = sap.ui.getCore().byId(oView.createId("tbDisputeList")).getBinding("items");
			oBinding.filter([oFilter]);
		},

		onDisputeListDialogCreate: function () {
			this.oDisputeListDialog.close();
			this._createDispute("");
		},

		/**
		 * Called when button Dispute is clicked.
		 * @public
		 */
		onDisputePress: function () {
			var oItem = this.getView().getBindingContext().getObject();

			if (oItem.DetailStatus === "A" || oItem.DetailStatus === "D" || oItem.DetailStatus === "R") {
				MessageBox.error(this.oBundle.getText("disputeActionNotAllowMessage"));
				return;
			}
			this.showBusy();
			this.getModel().callFunction("/GetConsolList", {
				method: "GET",
				urlParameters: {
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					CompanyCode: this.sCompanyCode,
					Carrier: this.sCarrier,
					AccountNo: this.sAccountNo
				},
				success: function (oData) {
					this.getModel("local").setProperty("/disputeList", oData.results);
					if (oData.results.length === 0) {
						this._createDispute("");
						return;
					}
					this.oDisputeListDialog = Utils.getFragment(null, "DisputeListDialog", this);
					this.oDisputeListDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Called when button Cancel is clicked.
		 * @public
		 */
		onCancelPress: function () {
			var sMsg = this.oBundle.getText("confirmCancelOneDtlMsg");
			var sTitle = this.oBundle.getText("confirmCancelTitle");
			var isRelease = false;
			var oData = this.getView().getBindingContext().getObject();
			if (oData.ObjectKey !== "" && oData.ObjectKey !== undefined) {
				isRelease = true;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction !== MessageBox.Action.OK) {
						return;
					}
					if (isRelease) {
						this._getReversalReason("com.erpis.shiperp.freightaudit.hd6.fragment.ReversalReasonDialog");
					} else {
						this._cancel("00");
					}
				}.bind(this)
			});
		},

		onReasonSelected: function (oEvent) {
			var params = oEvent.getParameters();
			var sReasonCode = params.selectedItem.getProperty("description");
			this._cancel(sReasonCode);
		},

		/**
		 * Called when button Update Status is clicked.
		 * @public
		 */
		onStatusClick: function () {
			// Open the Table Setting dialog
			if (!this._oDialog) { //=== undefined) {
				this._oDialog = sap.ui.xmlfragment("com.erpis.shiperp.freightaudit.hd6.fragment.StatusDialogDtl", this);
				this.getView().addDependent(this._oDialog);
			}
			this._oDialog.getBinding("items").filter([]);
			this._oDialog.open();
		},

		/**
		 * Called when select a status from the status dialog.
		 * @public
		 */
		onStatusChange: function (oEvent) {
			var sMsg = this.oBundle.getText("confirmSetStatusOneDtlMsg");
			var sTitle = this.oBundle.getText("confirmSetStatusTitle");
			var sStatusCode = oEvent.getParameters().selectedItem.getDescription();

			// fire dispute press in case of Dispute status is selected.
			if (sStatusCode === "D") {
				this.onDisputePress();
				return;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this._updateStatus(sStatusCode, this.getView().getBindingContext().getObject().ChangedDateTime);
					}
				}.bind(this)
			});
		},

		handleStatusDtlSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("Name", FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		/**
		 * Called when clicking on next button.
		 * @public
		 */
		onNextPress: function () {
			this.showBusy();
			this.getModel().callFunction("/NextTracking", {
				method: "POST",
				urlParameters: {
					InvoiceNo: this.sInvoiceNo,
					Vendor: this.sVendor,
					Filter: this.sFilterKey,
					TrackingNo: this.sTrackingNo
				},
				success: function (oData) {
					this._navigateToNext(oData, this.oBundle.getText("NextItemNotAvailable"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Called when clicking on previous button.
		 * @public
		 */
		onPrevPress: function () {
			this.showBusy();
			this.getModel().callFunction("/PrevTracking", {
				method: "POST",
				urlParameters: {
					InvoiceNo: this.sInvoiceNo,
					Vendor: this.sVendor,
					Filter: this.sFilterKey,
					TrackingNo: this.sTrackingNo
				},
				success: function (oData) {
					this._navigateToNext(oData, this.oBundle.getText("PrevItemNotAvailable"));
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
					this._handleODataError(oError);
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		/**
		 * Called when data of page wants to be refreshed.
		 * @public
		 */
		loadPageData: function (sVendor, sInvoiceNo, sTrackingNo) {
			var sObjectPath = this.getModel().createKey("xSERPERPxI_FADTL", {
				Vendor: sVendor,
				InvoiceNo: sInvoiceNo,
				TrackingNo: sTrackingNo
			});

			// Bind Odata to the screen
			this._bindView("/" + sObjectPath);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this)
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			// Check if the tracking no is in rejected status -> navigate back
			if (this.getView().getBindingContext().getObject().DetailStatus === "RE") {
				this.onNavBack();
				return;
			}

			this._refreshHeaderAndItems();

			// Everything went fine.
			$.when(this.oDeferredCarier, this.oDeferredShip).done(function () {
				this.hideBusy();
				this.oDeferredCarier = $.Deferred();
				this.oDeferredShip = $.Deferred();
			}.bind(this));
		},

		/**
		 * Method to update status of a TrackingNo
		 * @public
		 */
		_updateStatus: function (sStatusCode, sDatetime) {
			this.showBusy();
			this.getModel().callFunction("/SetItemStatus", {
				"method": "POST",
				headers: {
					"If-Match": 'W/"\'' + sDatetime + '\'"'
				},
				urlParameters: {
					Status: sStatusCode,
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: this.sTrackingNo
				},
				success: function () {
					this._refreshHeaderAndItems();
					MessageToast.show(this.oBundle.getText("sbUpdateStatusMsgSuccess"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._refreshHeaderAndItems();
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		/**
		 * Method to cancel status of a TrackingNo
		 * @public
		 */
		_cancel: function (sReason) {
			this.showBusy();
			this.getModel().callFunction("/CancelItem", {
				method: "POST",
				urlParameters: {
					Reason: sReason,
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: this.sTrackingNo
				},
				groupId: "FAMassCancelItem",
				changeSetId: "cancel"
			});
			this.getModel().submitChanges({
				groupId: "FAMassCancelItem",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbCancelSuccess"));
					}
					// REFRESH Table Control
					this._refreshHeaderAndItems();
					this.hideBusy();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		loadStatisticData: function () {
			// load approval status
			var aKeys = [{
				"prop": "countApproved",
				"value": "A"
			}, {
				"prop": "countOpen",
				"value": "O"
			}, {
				"prop": "countDisputed",
				"value": "D"
			}, {
				"prop": "countReleased",
				"value": "R"
			}];
			var fnLoadStatusCount = function (index, item) {
				this.getModel().read("/xSERPERPxI_FADTL/$count", {
					filters: [
						new Filter({
							filters: [
								new Filter("DetailStatus", FilterOperator.EQ, item.value),
								new Filter("InvoiceNo", FilterOperator.EQ, this.sInvoiceNo),
								new Filter("Vendor", FilterOperator.EQ, this.sVendor)
							],
							and: true
						})
					],
					success: function (oData) {
						this.getModel("local").setProperty("/" + item.prop, parseInt(oData, 10));
					}.bind(this)
				});
			}.bind(this);
			jQuery.each(aKeys, fnLoadStatusCount);
		},

		_createDispute: function (sDisputeID) {
			this.showBusy();
			this.getModel().callFunction("/DisputeItem", {
				method: "POST",
				urlParameters: {
					DisputeID: sDisputeID,
					Vendor: this.sVendor,
					InvoiceNo: this.sInvoiceNo,
					TrackingNo: this.sTrackingNo
				},
				groupId: "FAMassCreateDispute",
				changeSetId: "dispute"
			});
			this.getModel().submitChanges({
				groupId: "FAMassCreateDispute",
				success: function (oData) {
					//Strategy for success callback
					//1.If has error handle in function "_handleBatchResponseHasError"
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("msbCreateDipsuteTitleSucess"));
					}
					// REFRESH Table Control
					this._refreshHeaderAndItems();
					this.hideBusy();
				}.bind(this),
				error: function () {
					this.hideBusy();
				}.bind(this)
			});
		},

		_navigateToNext: function (oData, errorMsg) {
			if (this.sInvoiceNo !== oData.InvoiceNo ||
				this.sVendor !== oData.Vendor ||
				this.sTrackingNo !== oData.TrackingNo) {
				this.getRouter().navTo("conditionDetail", {
					InvoiceNo: oData.InvoiceNo,
					Vendor: oData.Vendor,
					AccountNo: this.sAccountNo,
					CompanyCode: this.sCompanyCode,
					Carrier: this.sCarrier,
					TrackingNo: oData.TrackingNo,
					filterKey: this.sFilterKey
				}, true);
			} else {
				this._refreshHeaderAndItems();
				MessageBox.warning(errorMsg);
				this.hideBusy();
			}
		},

		_refreshHeaderAndItems: function () {
			// Refresh Header element
			this.getView().getElementBinding().refresh();

			// Refresh 2 tables
			this.byId("tblShipERP").getBinding("items").refresh();
			this.byId("tblCarrier").getBinding("items").refresh();

			// load statistic data
			this.loadStatisticData();

			// Refresh FA Header
			var sPath = "/xSERPERPxI_FAHDR(InvoiceNo='" + this.sInvoiceNo + "',Vendor='" + this.sVendor + "')";
			this.getModel().read(sPath);
		}

	});
});