import { TableColumn } from '../models/table-config.model';

export const PARTICIPANT_COLUMNS: TableColumn[] = [
  { field: 'bibNumber', header: 'BIB Number', required: true, disabled: false },
  { field: 'chipNumber', header: 'Chip Number', required: true, disabled: false },
  { field: 'fullName', header: 'Full Name', required: true, disabled: false },
  { field: 'email', header: 'Email' },
  { field: 'phoneNumber', header: 'Phone' },
  { field: 'raceName', header: 'Race' },
  { field: 'categoryName', header: 'Category' },
  { field: 'gender', header: 'Gender' },
  { field: 'age', header: 'Age' },
  { field: 'dateOfBirth', header: 'Date of Birth' },
  { field: 'city', header: 'City' },
  { field: 'country', header: 'Country' },
  { field: 'bibCollectedAt', header: 'BIB Collected' },
  { field: 'emergencyContactName', header: 'Emergency Contact' },
  { field: 'emergencyContactPhone', header: 'Emergency Phone' },
];

export const PARTICIPANT_SORT_OPTIONS = [
  { label: 'BIB Number (Asc)', value: 'bibNumber,asc' },
  { label: 'BIB Number (Desc)', value: 'bibNumber,desc' },
  { label: 'Full Name (A-Z)', value: 'fullName,asc' },
  { label: 'Full Name (Z-A)', value: 'fullName,desc' },
  { label: 'Race (A-Z)', value: 'raceName,asc' },
  { label: 'Race (Z-A)', value: 'raceName,desc' },
  { label: 'Category (A-Z)', value: 'categoryName,asc' },
  { label: 'Category (Z-A)', value: 'categoryName,desc' },
];

export const GENDER_OPTIONS = [
  { label: 'All Genders', value: '' },
  { label: 'Male', value: 'M' },
  { label: 'Female', value: 'F' },
  { label: 'Other', value: 'O' },
];
