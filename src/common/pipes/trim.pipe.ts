import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (typeof value === 'string') {
            return value.trim();
        }

        if (typeof value === 'object' && value !== null) {
            const trimmed = {};
            for (const key in value) {
                if (typeof value[key] === 'string') {
                    trimmed[key] = value[key].trim();
                } else {
                    trimmed[key] = value[key];
                }
            }
            return trimmed;
        }

        return value;
    }
}
