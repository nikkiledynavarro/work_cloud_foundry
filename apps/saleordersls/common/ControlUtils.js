sap.ui.define([], function () {
	"use strict";
	return {
		BuildControlByType: function (oFieldConfig, oController) {
			var oControlBase;
				this._destroyCurrField(oFieldConfig.FieldName); //remove old field prevent duplicate Tim 21/9/2021
			if (oFieldConfig.FieldType === "01") {
				//Checkbox
				oControlBase = this.CheckBoxField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
			} else if (oFieldConfig.FieldType === "02") {
				//combobox
				var values = (oFieldConfig.MoreOptionItemSet) ? oFieldConfig.MoreOptionItemSet : [];
				oControlBase = this.ComboBoxField(oFieldConfig.FieldName, oFieldConfig.FieldValue, values);
			} else if (oFieldConfig.FieldType === "03") {
				//Input
				// oControlBase = this.InputField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
					var oFieldBase = new sap.m.Input({
				id: oFieldConfig.FieldName,
				value: oFieldConfig.FieldValue         
			});
			return oFieldBase;
			} else if (oFieldConfig.FieldType === "04") {
				//Date range
				oControlBase = this.DateRangeSelectionField(oFieldConfig.FieldName, oFieldConfig.FieldValue, oFieldConfig.FieldValue02);
			} else if (oFieldConfig.FieldType === "05") {
				//date picker
				oControlBase = this.DatePickerField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
			} else if (oFieldConfig.FieldType === "06") {
				//radio button
				oControlBase = this.RadioButtonField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
			} else if (oFieldConfig.FieldType === "07") {
				//time picker
				oControlBase = this.TimePickerField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
			} else if (oFieldConfig.FieldType === "08") {
				//Button Event
				var oCallbackData = {
					key: oFieldConfig.FieldName,
					text: oFieldConfig.FieldDesc
				};
				oControlBase = this.ButtonField(oFieldConfig.FieldDesc, oCallbackData, oFieldConfig.FnCallback);
			} else {
				oControlBase = this.InputField(oFieldConfig.FieldName, oFieldConfig.FieldValue);
			}
			return oControlBase;
		},
		Label: function (FieldDesc) {
			var oLabel = new sap.m.Label({
				text: FieldDesc,
				wrapping: false,
				tooltip: FieldDesc
			});
			return oLabel;
		},
		CheckBoxField: function (FieldName, FieldValue) {
			var bValue = false;
			if (FieldValue === "") {
				bValue = false;
			} else if (FieldValue === "true" || FieldValue === "X") {
				bValue = true;
			} else if (FieldValue === "false") {
				bValue = false;
			} else {
				bValue = false;
			}
			var oFieldBase = new sap.m.CheckBox({
				id: FieldName,
				selected: bValue
			});
			return oFieldBase;

		},
		ComboBoxField: function (FieldName, FieldValue, aSource) {
			var oInput = new sap.m.ComboBox({
				id: FieldName,
				selectedKey: FieldValue
			});
			if (aSource.length > 0) {
				for (var j = 0; j < aSource.length; j++) {
					var oItem = new sap.ui.core.Item({
						key: aSource[j].Key,
						text: aSource[j].Value
					});
					oInput.addItem(oItem);
				}
			}
			return oInput;

		},
		InputField: function (FieldName, FieldValue) {
			var oFieldBase = new sap.m.Input({
				id: FieldName,
				value: FieldValue
			});
			return oFieldBase;

		},
		DateRangeSelectionField: function (FieldName, FieldValue, FieldValue02) {
			var oFromDate = null,
				oToDate = null;
			var sString = FieldValue;
			if (sString.length === 8) {
				oFromDate = new Date(sString.slice(0, 4), parseInt(sString.slice(4, 6), 10) - 1, sString.slice(6));
			}
			sString = FieldValue02;
			if (sString.length === 8) {
				oToDate = new Date(sString.slice(0, 4), parseInt(sString.slice(4, 6), 10) - 1, sString.slice(6));
			}
			var oFieldBase = new sap.m.DateRangeSelection({
				id: FieldName,
				displayFormat: "MM/dd/yyyy",
				dateValue: oFromDate,
				secondDateValue: oToDate
			});
			return oFieldBase;

		},
		DatePickerField: function (FieldName, FieldValue) {

			var oFieldBase = new sap.m.DatePicker({
				id: FieldName,
				value: FieldValue,
				valueFormat: "yyyyMMdd",
				displayFormat: "MM/dd/yyyy"
			});
			return oFieldBase;
		},
		RadioButtonField: function (FieldName, FieldValue) {
			var bCheck = (typeof FieldValue === "boolean") ? FieldValue : false;
			var oFieldBase = new sap.m.RadioButton({
				id: FieldName,
				selected: bCheck
			});
			return oFieldBase;

		},
		TimePickerField: function (FieldName, FieldValue) {
			var oFieldBase = new sap.m.TimePicker({
				id: FieldName,
				value: FieldValue,
				valueFormat: "HHmmss",
				displayFormat: "HH:mm"
			});
			return oFieldBase;

		},
		ButtonField: function (FieldText, CallbackData, FnCallback) {
				var oFieldBase = new sap.m.Button({
					text: FieldText,
					press: function () {
						if (FnCallback) {
							FnCallback(CallbackData);
						}
					}
				});
				return oFieldBase;

			},
		//prevent duplicate field
		_destroyCurrField: function (FieldName) {
				var oCurrControl = sap.ui.getCore().byId(FieldName);
				if (oCurrControl) {
					oCurrControl.destroy();
				}
			} //end

	};
});