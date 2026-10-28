"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import {
  INDONESIA_PROVINCES,
  type IndonesiaCity,
} from "@/lib/indonesia-regions";
import { cn } from "@/lib/utils";

export interface AddressFieldsLabels {
  province: string;
  city: string;
  postalCode: string;
}

export interface AddressFieldsHints {
  province?: string;
  city?: string;
  postalCode?: string;
}

export interface AddressFieldsErrors {
  province?: string;
  city?: string;
  postalCode?: string;
}

export interface AddressFieldsProps {
  province: string;
  city: string;
  postalCode: string;
  onProvinceChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  labels: AddressFieldsLabels;
  hints?: AddressFieldsHints;
  errors?: AddressFieldsErrors;
  disabled?: boolean;
  className?: string;
  onCitySelected?: (city: IndonesiaCity) => void;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

function cityBaseName(value: string) {
  return value.replace(/^(kota|kabupaten)\s+/i, "");
}

function findProvince(name: string) {
  const target = normalize(name);
  return INDONESIA_PROVINCES.find((province) => normalize(province.name) === target);
}

function findCity(
  province: ReturnType<typeof findProvince>,
  city: string,
  postalCode: string,
) {
  if (!province || !city.trim()) return undefined;

  const target = normalize(city);
  const exact = province.cities.find((item) => normalize(item.name) === target);
  if (exact) return exact;

  const byBaseName = province.cities.filter(
    (item) => normalize(cityBaseName(item.name)) === target,
  );
  if (byBaseName.length === 1) return byBaseName[0];

  const postal = postalCode.trim();
  if (postal) {
    const byPostal = province.cities.find((item) => item.postalCodes.includes(postal));
    if (byPostal) return byPostal;
  }

  return byBaseName[0];
}

/**
 * Cascading province -> city/regency -> postal-code fields. Changing a parent
 * field clears the child values so the submitted address can never mix regions.
 */
export function AddressFields({
  province,
  city,
  postalCode,
  onProvinceChange,
  onCityChange,
  onPostalCodeChange,
  labels,
  hints,
  errors,
  disabled = false,
  className,
  onCitySelected,
}: AddressFieldsProps) {
  const t = useTranslations("common");

  const provinceRecord = useMemo(() => findProvince(province), [province]);
  const cityRecord = useMemo(
    () => findCity(provinceRecord, city, postalCode),
    [city, postalCode, provinceRecord],
  );

  const provinceOptions = useMemo<SearchSelectOption[]>(
    () => INDONESIA_PROVINCES.map((item) => ({ value: item.name, label: item.name })),
    [],
  );

  const cityOptions = useMemo<SearchSelectOption[]>(
    () =>
      provinceRecord?.cities.map((item) => ({
        value: item.name,
        label: item.name,
      })) ?? [],
    [provinceRecord],
  );

  const postalOptions = useMemo<SearchSelectOption[]>(
    () =>
      cityRecord?.postalCodes.map((code) => ({
        value: code,
        label: code,
      })) ?? [],
    [cityRecord],
  );

  const handleProvinceChange = (value: string) => {
    onProvinceChange(value);
    if (normalize(value) !== normalize(province)) {
      onCityChange("");
      onPostalCodeChange("");
    }
  };

  const handleCityChange = (value: string) => {
    onCityChange(value);
    if (normalize(value) !== normalize(city)) {
      onPostalCodeChange("");
    }
    const selected = provinceRecord?.cities.find(
      (item) => normalize(item.name) === normalize(value),
    );
    if (selected) onCitySelected?.(selected);
  };

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      <Field label={labels.province} hint={hints?.province} error={errors?.province}>
        <SearchSelect
          value={province}
          onChange={handleProvinceChange}
          options={provinceOptions}
          placeholder={t("selectProvince")}
          emptyMessage={t("noOptions")}
          clearLabel={t("clearSelection")}
          disabled={disabled}
          ariaLabel={labels.province}
        />
      </Field>

      <Field label={labels.city} hint={hints?.city} error={errors?.city}>
        <SearchSelect
          value={city}
          onChange={handleCityChange}
          options={cityOptions}
          placeholder={provinceRecord ? t("selectCity") : t("selectProvinceFirst")}
          emptyMessage={t("noOptions")}
          clearLabel={t("clearSelection")}
          disabled={disabled || !provinceRecord}
          ariaLabel={labels.city}
        />
      </Field>

      <Field label={labels.postalCode} hint={hints?.postalCode} error={errors?.postalCode}>
        <SearchSelect
          value={postalCode}
          onChange={onPostalCodeChange}
          options={postalOptions}
          placeholder={cityRecord ? t("selectPostalCode") : t("selectCityFirst")}
          emptyMessage={t("noOptions")}
          clearLabel={t("clearSelection")}
          disabled={disabled || !cityRecord}
          inputMode="numeric"
          ariaLabel={labels.postalCode}
        />
      </Field>
    </div>
  );
}
