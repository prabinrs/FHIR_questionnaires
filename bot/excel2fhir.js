import { BotEvent, MedplumClient } from '@medplum/core';
import { Patient } from '@medplum/fhirtypes';
import * as xlsx from 'xlsx';

export async function handler(medplum: MedplumClient, event: BotEvent): Promise<string> {
  const systemString = 'www.myhospitalsystem.org/IDs';

  // Path to the uploaded Excel file (this can be configured based on your bot event or upload trigger)
  const filePath = 'path_to_excel/patients.xlsx';

  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const patientsData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  for (const patientData of patientsData) {
    const { patientID, patientName, address, contactinfo } = patientData;

    // Split patient name into given and family (assuming the name format is "First Last")
    const [givenName, ...familyNameArr] = patientName.split(' ');
    const familyName = familyNameArr.join(' ');

    // Search for existing patient by their ID (mrnNumber)
    let patient = await medplum.searchOne('Patient', 'identifier=' + patientID);

    if (patient) {
      console.log(`Patient ${givenName} ${familyName} already exists in the system`);

      // Update patient information if they already exist
      patient.name = [
        {
          given: [givenName],
          family: familyName,
        },
      ];
      patient.address = [
        {
          text: address,
        },
      ];
      patient.telecom = [
        {
          system: 'phone',
          value: contactinfo,
          use: 'mobile',
        },
      ];
      patient = await medplum.updateResource<Patient>(patient);
    } else {
      // Create a new Patient resource
      patient = await medplum.createResource<Patient>({
        resourceType: 'Patient',
        name: [
          {
            given: [givenName],
            family: familyName,
          },
        ],
        identifier: [
          {
            system: systemString,
            value: patientID,
          },
        ],
        address: [
          {
            text: address,
          },
        ],
        telecom: [
          {
            system: 'phone',
            value: contactinfo,
            use: 'mobile',
          },
        ],
      });
      console.log(`Patient ${givenName} ${familyName} created with ID: ${patient.id}`);
    }
  }

  // Return success message
  return 'Patient import completed';
}
