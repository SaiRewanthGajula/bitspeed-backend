import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router: Router = express.Router();
const prisma = new PrismaClient();

interface IdentifyRequestBody {
  email?: string;
  phoneNumber?: string;
}

interface IdentifyResponseBody {
  contact: {
    primaryContatctId: number;
    emails: (string | null)[];
    phoneNumbers: (string | null)[];
    secondaryContactIds: number[];
  };
}

// Optional GET endpoint for debugging
router.get('/identify', (req: Request, res: Response) => {
  res.json({ message: 'Use POST /identify with a JSON body containing email and/or phoneNumber.' });
});

router.post('/identify', async (req: Request, res: Response<IdentifyResponseBody>) => {
  const { email, phoneNumber } = req.body as IdentifyRequestBody;

  // Validate input
  if (!email && !phoneNumber) {
    return res.status(400).json({ contact: { primaryContatctId: 0, emails: [], phoneNumbers: [], secondaryContactIds: [] } });
  }

  try {
    // Find existing contacts matching email or phoneNumber
    const conditions = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });

    const existingContacts = await prisma.contact.findMany({
      where: { OR: conditions, deletedAt: null },
    });

    // If no existing contacts, create a new primary contact
    if (existingContacts.length === 0) {
      const newPrimary = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'primary',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newPrimary.id,
          emails: newPrimary.email ? [newPrimary.email] : [],
          phoneNumbers: newPrimary.phoneNumber ? [newPrimary.phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // Collect all related contacts
    const allRelatedContacts = new Set<number>();
    for (const contact of existingContacts) {
      const primaryId = contact.linkPrecedence === 'primary' ? contact.id : contact.linkedId;
      if (primaryId) {
        const related = await prisma.contact.findMany({
          where: {
            OR: [{ id: primaryId }, { linkedId: primaryId }],
            deletedAt: null,
          },
        });
        related.forEach((c) => allRelatedContacts.add(c.id));
      } else {
        allRelatedContacts.add(contact.id);
      }
    }

    const allContacts = await prisma.contact.findMany({
      where: { id: { in: Array.from(allRelatedContacts) }, deletedAt: null },
    });

    // Determine if new contact is needed
    const emails = new Set(allContacts.map((c) => c.email).filter(Boolean));
    const phoneNumbers = new Set(allContacts.map((c) => c.phoneNumber).filter(Boolean));
    let newContact = null;

    if ((email && !emails.has(email)) || (phoneNumber && !phoneNumbers.has(phoneNumber))) {
      const primary = allContacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'secondary',
          linkedId: primary.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      allContacts.push(newContact);
      if (newContact.email) emails.add(newContact.email);
      if (newContact.phoneNumber) phoneNumbers.add(newContact.phoneNumber);
    }

    // Find the primary contact (earliest created)
    const primaryContact = allContacts
      .filter((c) => c.linkPrecedence === 'primary')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

    // Update other primary contacts to secondary if needed
    for (const contact of allContacts) {
      if (contact.id !== primaryContact.id && contact.linkPrecedence === 'primary') {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkPrecedence: 'secondary',
            linkedId: primaryContact.id,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Refresh contacts after updates
    const updatedContacts = await prisma.contact.findMany({
      where: { id: { in: allContacts.map((c) => c.id) }, deletedAt: null },
    });

    const finalEmails = Array.from(new Set(updatedContacts.map((c) => c.email).filter(Boolean)));
    const finalPhoneNumbers = Array.from(new Set(updatedContacts.map((c) => c.phoneNumber).filter(Boolean)));
    const secondaryContactIds = updatedContacts
      .filter((c) => c.id !== primaryContact.id)
      .map((c) => c.id);

    return res.status(200).json({
      contact: {
        primaryContatctId: primaryContact.id,
        emails: finalEmails,
        phoneNumbers: finalPhoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error('Error processing /identify:', error);
    return res.status(500).json({
      contact: { primaryContatctId: 0, emails: [], phoneNumbers: [], secondaryContactIds: [] },
    });
  }
});

export default router;